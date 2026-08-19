const ELEVENLABS_API_KEY = (import.meta.env.VITE_ELEVENLABS_API_KEY || '').trim();

// Mismo patrón que AIError en services/ai.js: código traducible en vez de texto fijo,
// para que el mensaje se resuelva en el idioma activo (ver src/i18n).
export class TranscribeError extends Error {
  constructor(code, params = {}) {
    super(code);
    this.name = 'TranscribeError';
    this.code = code;
    this.params = params;
  }
}

// Scribe v2: modelo batch de ElevenLabs, optimizado para grabaciones largas y
// condiciones de audio difíciles (pausas, acentos, ruido de fondo).
const SCRIBE_MODEL = 'scribe_v2';

// Guardarraíl de tamaño razonable para una grabación de reunión desde el navegador
// (ElevenLabs soporta archivos mucho más grandes, esto solo evita envíos absurdos).
const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;

export function isTranscribeConfigured() {
  return Boolean(ELEVENLABS_API_KEY);
}

/**
 * Transcribe un audio grabado en el navegador (Blob de MediaRecorder) usando
 * Scribe v2 de ElevenLabs. Pensado para reemplazar la transcripción en vivo
 * (Web Speech API) por una versión mucho más precisa una vez termina la grabación.
 *
 * @param {Blob} blob - audio grabado (webm/opus típicamente)
 * @param {{ language?: 'es' | 'en' }} options
 * @returns {Promise<string>} texto transcrito
 */
export async function transcribeAudio(blob, { language } = {}) {
  if (!ELEVENLABS_API_KEY) {
    throw new TranscribeError('err_transcribe_no_key');
  }
  if (!blob || blob.size === 0) {
    throw new TranscribeError('err_transcribe_empty');
  }
  if (blob.size > MAX_FILE_SIZE_BYTES) {
    throw new TranscribeError('err_transcribe_too_large');
  }

  const form = new FormData();
  form.append('file', blob, 'recording.webm');
  form.append('model_id', SCRIBE_MODEL);
  // ElevenLabs acepta código ISO 639-1 ('es'/'en'); si no se pasa, autodetecta el idioma.
  if (language) form.append('language_code', language);

  let response;
  try {
    response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        Accept: 'application/json',
      },
      body: form,
    });
  } catch {
    throw new TranscribeError('err_transcribe_network');
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new TranscribeError('err_transcribe_no_key');
    }
    if (response.status === 429) {
      throw new TranscribeError('err_transcribe_rate_limit');
    }
    const detail = await response.text().catch(() => '');
    throw new TranscribeError('err_transcribe_provider', { detail });
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new TranscribeError('err_transcribe_provider', { detail: 'respuesta no válida' });
  }

  const text = (data?.text || '').trim();
  if (!text) {
    throw new TranscribeError('err_transcribe_empty_result');
  }
  return text;
}
