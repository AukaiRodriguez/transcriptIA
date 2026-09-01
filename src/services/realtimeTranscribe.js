import { createVoiceBoostChain } from '../utils/audioBoost';

const ELEVENLABS_API_KEY = (import.meta.env.VITE_ELEVENLABS_API_KEY || '').trim();

// Mismo patrón que AIError/TranscribeError: código traducible en vez de texto fijo.
export class RealtimeError extends Error {
  constructor(code, params = {}) {
    super(code);
    this.name = 'RealtimeError';
    this.code = code;
    this.params = params;
  }
}

const REALTIME_WS_URL = 'https://api.elevenlabs.io/v1/speech-to-text/realtime'.replace('https://', 'wss://');
const REALTIME_MODEL = 'scribe_v2_realtime';
const TARGET_SAMPLE_RATE = 16000;
const RECOGNITION_LANGUAGE = { es: 'es', en: 'en' };

export function isRealtimeConfigured() {
  return Boolean(ELEVENLABS_API_KEY) && typeof window !== 'undefined' && typeof WebSocket !== 'undefined';
}

// El token de un solo uso permite conectar el WebSocket desde el navegador sin
// exponer la key en la URL/handshake. Igual requiere que VITE_ELEVENLABS_API_KEY
// esté disponible en el bundle del cliente para pedirlo (esta app no tiene backend
// propio) — mismo trade-off de seguridad que el resto de las integraciones de este
// proyecto (ver advertencias en README sobre exponer keys en apps 100% cliente).
async function mintSingleUseToken() {
  if (!ELEVENLABS_API_KEY) {
    throw new RealtimeError('err_realtime_no_key');
  }
  let response;
  try {
    response = await fetch('https://api.elevenlabs.io/v1/single-use-token/realtime_scribe', {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
    });
  } catch {
    throw new RealtimeError('err_realtime_network');
  }
  if (!response.ok) {
    if (response.status === 401) throw new RealtimeError('err_realtime_no_key');
    const detail = await response.text().catch(() => '');
    throw new RealtimeError('err_realtime_provider', { detail });
  }
  const data = await response.json().catch(() => null);
  if (!data?.token) throw new RealtimeError('err_realtime_provider', { detail: 'token vacío' });
  return data.token;
}

// --- Utilidades de audio: el protocolo exige PCM 16-bit mono a 16kHz, pero el
// micrófono del navegador entrega Float32 al sample rate nativo del dispositivo
// (usualmente 44.1kHz o 48kHz) — hay que remuestrear y convertir el formato. ---

function downsampleTo16k(float32Array, inputSampleRate) {
  if (inputSampleRate === TARGET_SAMPLE_RATE) return float32Array;
  const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
  const newLength = Math.round(float32Array.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < newLength) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < float32Array.length; i++) {
      accum += float32Array[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function base64FromArrayBuffer(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Abre una sesión de transcripción en tiempo real con ElevenLabs Scribe v2 Realtime.
 * Captura el micrófono, remuestrea a PCM 16kHz, y transmite el audio por WebSocket,
 * entregando texto parcial y confirmado a medida que se genera (~150ms de latencia).
 *
 * @param {{
 *   language?: 'es' | 'en',
 *   onPartial?: (text: string) => void,
 *   onCommitted?: (text: string) => void,
 *   onSpeakingChange?: (isSpeaking: boolean) => void,
 *   onError?: (err: RealtimeError) => void,
 *   onOpen?: () => void,
 * }} options
 * @returns {Promise<{ stop: () => void }>}
 */
export async function startRealtimeTranscription({
  language,
  onPartial,
  onCommitted,
  onSpeakingChange,
  onError,
  onOpen,
} = {}) {
  const token = await mintSingleUseToken();

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContextClass();
  const source = audioContext.createMediaStreamSource(stream);

  // ScriptProcessorNode está deprecado en favor de AudioWorklet, pero sigue
  // soportado en todos los navegadores relevantes y no requiere cargar un
  // módulo extra — suficiente para el volumen de audio de una grabación de
  // reunión/clase. Se conecta a un GainNode en silencio (no a los parlantes)
  // únicamente porque algunos navegadores no disparan onaudioprocess si el
  // nodo no está conectado a un destino.
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const boosted = createVoiceBoostChain(audioContext, source);
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;
  boosted.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(audioContext.destination);

  const params = new URLSearchParams({
    model_id: REALTIME_MODEL,
    token,
    audio_format: `pcm_${TARGET_SAMPLE_RATE}`,
    commit_strategy: 'vad', // segmentación automática por silencio, sin necesidad de commits manuales
  });
  const langCode = RECOGNITION_LANGUAGE[language];
  if (langCode) params.set('language_code', langCode);

  const ws = new WebSocket(`${REALTIME_WS_URL}?${params.toString()}`);
  let stopped = false;
  let speaking = false;

  function cleanup() {
    stopped = true;
    try { processor.disconnect(); } catch { /* noop */ }
    try { boosted.disconnect(); } catch { /* noop */ }
    try { silentGain.disconnect(); } catch { /* noop */ }
    try { source.disconnect(); } catch { /* noop */ }
    try { audioContext.close(); } catch { /* noop */ }
    stream.getTracks().forEach((tr) => tr.stop());
    try { if (ws.readyState === WebSocket.OPEN) ws.close(); } catch { /* noop */ }
  }

  processor.onaudioprocess = (e) => {
    if (stopped || ws.readyState !== WebSocket.OPEN) return;
    const input = e.inputBuffer.getChannelData(0);
    const downsampled = downsampleTo16k(input, audioContext.sampleRate);
    const pcm16 = floatTo16BitPCM(downsampled);
    const audioBase64 = base64FromArrayBuffer(pcm16);
    ws.send(JSON.stringify({ message_type: 'input_audio_chunk', audio_base_64: audioBase64 }));
  };

  // IMPORTANTE: la promesa que devuelve esta función solo se resuelve cuando el
  // servidor confirma la sesión (mensaje "session_started"), NO simplemente al
  // construir el WebSocket. Antes se resolvía de inmediato, así que una key
  // inválida o una conexión fallida quedaban "silenciosamente activas": el
  // llamador creía que Realtime funcionaba, nunca caía al reconocimiento del
  // navegador, y el micrófono no transcribía nada. Con un error/cierre antes de
  // confirmar la sesión, ahora se rechaza explícitamente para que el fallback
  // funcione de verdad.
  return new Promise((resolve, reject) => {
    let settled = false;
    const CONNECT_TIMEOUT_MS = 10000;

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new RealtimeError('err_realtime_network'));
    }, CONNECT_TIMEOUT_MS);

    function settleError(err) {
      if (!settled) {
        settled = true;
        clearTimeout(timeoutId);
        cleanup();
        reject(err);
      } else if (!stopped) {
        onError?.(err);
      }
    }

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      switch (msg.message_type) {
        case 'session_started':
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            onOpen?.();
            resolve({ stop: cleanup });
          }
          break;
        case 'partial_transcript':
          if (!speaking) { speaking = true; onSpeakingChange?.(true); }
          onPartial?.(msg.text || '');
          break;
        case 'committed_transcript':
          speaking = false;
          onSpeakingChange?.(false);
          onCommitted?.(msg.text || '');
          break;
        case 'scribe_auth_error':
        case 'scribeAuthError':
          settleError(new RealtimeError('err_realtime_no_key'));
          break;
        case 'scribe_rate_limited_error':
        case 'scribeRateLimitedError':
        case 'rate_limited':
          settleError(new RealtimeError('err_realtime_rate_limit'));
          break;
        case 'scribe_quota_exceeded_error':
        case 'scribeQuotaExceededError':
          settleError(new RealtimeError('err_realtime_quota'));
          break;
        case 'error':
        case 'scribeError':
        case 'scribeInputError':
        case 'scribeTranscriberError':
        case 'scribeInvalidRequestError':
          settleError(new RealtimeError('err_realtime_provider', { detail: msg.error || msg.message || '' }));
          break;
        default:
          break; // warnings, timestamps, entidades, etc. — no requieren acción
      }
    };

    ws.onerror = () => {
      settleError(new RealtimeError('err_realtime_network'));
    };

    ws.onclose = () => {
      if (!settled) {
        settleError(new RealtimeError('err_realtime_network'));
        return;
      }
      if (!stopped) {
        speaking = false;
        onSpeakingChange?.(false);
      }
    };
  });
}
