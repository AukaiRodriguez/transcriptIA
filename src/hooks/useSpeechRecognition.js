import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { startRealtimeTranscription, isRealtimeConfigured } from '../services/realtimeTranscribe';
import { createVoiceBoostChain } from '../utils/audioBoost';

const RECOGNITION_LOCALE = { es: 'es-ES', en: 'en-US' };

// Codecs en orden de preferencia. No todos los navegadores soportan los mismos
// (ej. Safari no soporta audio/webm), así que se elige el primero disponible en
// vez de forzar uno fijo — forzar uno no soportado hacía fallar la grabación en
// silencio en esos navegadores.
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

function pickSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export function useSpeechRecognition() {
  const { language, t } = useLanguage();
  const [isRecording, setIsRecording]         = useState(false);
  const [isSpeaking, setIsSpeaking]           = useState(false);
  const [transcript, setTranscript]           = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [audioError, setAudioError]           = useState(null);
  // 'elevenlabs-realtime' | 'browser' | null (aún no se ha empezado a grabar)
  const [transcriptionSource, setTranscriptionSource] = useState(null);

  const recognitionRef = useRef(null);
  const shouldRestartRef = useRef(false);
  const segmentStartRef = useRef(null);
  const accumulatedMsRef = useRef(0);

  // Sesión de ElevenLabs Scribe v2 Realtime (cuando está configurada y disponible)
  const realtimeSessionRef = useRef(null);
  // Si Realtime falla al arrancar en esta grabación, no lo reintentamos en cada
  // "reanudar" — nos quedamos en el fallback del navegador por el resto de la sesión.
  const realtimeUnavailableRef = useRef(false);

  // Captura del audio real (solo se usa como respaldo cuando NO se pudo usar
  // ElevenLabs Realtime, para poder mandarlo después a Scribe v2 en modo batch
  // y mejorar la transcripción del navegador — ver services/transcribe.js).
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioMimeTypeRef = useRef('');
  // AudioContext usado para realzar el audio (compresor + ganancia) antes de
  // grabarlo — separado del stream crudo del micrófono, que se sigue deteniendo
  // igual al terminar (para apagar el indicador de "usando micrófono").
  const boostContextRef = useRef(null);

  // Build recognition instance once. No depende de `language` a propósito: si el
  // idioma cambia, el segundo efecto de abajo actualiza recognition.lang sin
  // recrear la instancia (evita perder la sesión de grabación en curso).
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous     = true;
    recognition.interimResults = true;
    recognition.lang           = RECOGNITION_LOCALE[language] || 'es-ES';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalStr  = '';
      let interimStr = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalStr += text + ' ';
        } else {
          interimStr += text;
        }
      }
      if (finalStr) setTranscript(prev => prev + finalStr);
      setInterimTranscript(interimStr);
    };

    recognition.onspeechstart = () => setIsSpeaking(true);
    recognition.onspeechend = () => setIsSpeaking(false);

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return; // normal – simplemente no detectó habla aún
      console.error('Speech recognition error:', event.error);

      // Errores permanentes: no tiene sentido seguir reintentando el auto-restart,
      // solo van a volver a fallar y dar la sensación de que "nunca escucha".
      const permanentErrors = ['not-allowed', 'audio-capture', 'service-not-allowed'];
      if (permanentErrors.includes(event.error)) {
        shouldRestartRef.current = false;
        setAudioError(`browser_${event.error}`);
      } else if (event.error === 'network') {
        // Transitorio: Web Speech API necesita internet; puede recuperarse solo
        // al reintentar, así que dejamos que el auto-restart de onend lo maneje,
        // pero avisamos igual por si el problema persiste.
        setAudioError('browser_network');
      }
    };

    recognition.onend = () => {
      setInterimTranscript('');
      setIsSpeaking(false);
      // auto-restart only if we're supposed to still be recording
      if (shouldRestartRef.current) {
        try { recognition.start(); } catch {}
      } else {
        setIsRecording(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldRestartRef.current = false;
      try { recognition.stop(); } catch {}
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(tr => tr.stop());
      }
      try { boostContextRef.current?.close(); } catch {}
      try { realtimeSessionRef.current?.stop(); } catch {}
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mantiene el idioma de reconocimiento de voz sincronizado con el idioma de la UI
  // (afecta a la próxima vez que se inicie/reinicie el reconocimiento, no a media grabación).
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = RECOGNITION_LOCALE[language] || 'es-ES';
    }
  }, [language]);

  // --- Fallback: reconocimiento de voz del navegador + MediaRecorder para la
  // mejora batch posterior con Scribe v2 (comportamiento previo a Realtime). ---
  const startBrowserFallback = useCallback(async () => {
    setTranscriptionSource('browser');
    if (!recognitionRef.current) {
      alert(t('speech_not_supported'));
      setIsRecording(false);
      return;
    }
    try { recognitionRef.current.start(); } catch {}

    // Grabación de audio real para transcripción precisa post-grabación.
    // Si falla (permiso denegado, sin micrófono, etc.), lo reportamos via
    // audioError en vez de solo dejarlo en consola.
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
      } else if (!mediaRecorderRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        streamRef.current = stream;

        // Realza la voz (compresor + ganancia) antes de grabarla, para que
        // capte mejor cuando se habla bajito o lejos del micrófono — el
        // autoGainControl nativo del navegador por sí solo suele ser tibio.
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const boostContext = new AudioContextClass();
        const micSource = boostContext.createMediaStreamSource(stream);
        const boosted = createVoiceBoostChain(boostContext, micSource);
        const dest = boostContext.createMediaStreamDestination();
        boosted.connect(dest);
        boostContextRef.current = boostContext;
        const recordStream = dest.stream;

        const mimeType = pickSupportedMimeType();
        audioMimeTypeRef.current = mimeType || 'audio/webm';
        const recorder = mimeType
          ? new MediaRecorder(recordStream, { mimeType })
          : new MediaRecorder(recordStream);

        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.onerror = (e) => {
          console.error('Error del MediaRecorder:', e.error || e);
          setAudioError(e.error?.name || 'unknown');
        };
        mediaRecorderRef.current = recorder;
        recorder.start(1000);
      }
    } catch (err) {
      console.error('No se pudo iniciar la grabación de audio para transcripción precisa:', err);
      setAudioError(err?.name || 'unknown');
    }
  }, [t]);

  const startRecording = useCallback(async () => {
    setAudioError(null);
    shouldRestartRef.current = true;
    segmentStartRef.current = Date.now();
    setIsRecording(true);

    // 1) Preferimos ElevenLabs Scribe v2 Realtime si hay key configurada y no
    // falló ya antes en esta misma grabación.
    if (isRealtimeConfigured() && !realtimeUnavailableRef.current) {
      try {
        const session = await startRealtimeTranscription({
          language,
          onPartial: (text) => setInterimTranscript(text),
          onCommitted: (text) => {
            if (!text) return;
            setTranscript(prev => (prev ? prev + ' ' : '') + text);
            setInterimTranscript('');
          },
          onSpeakingChange: setIsSpeaking,
          onError: (err) => {
            console.warn('ElevenLabs Realtime:', err.code);
            setAudioError(err.code);
          },
        });
        realtimeSessionRef.current = session;
        setTranscriptionSource('elevenlabs-realtime');
        return;
      } catch (err) {
        console.warn('No se pudo iniciar ElevenLabs Realtime, se usa el reconocimiento del navegador:', err.message);
        realtimeUnavailableRef.current = true;
      }
    }

    // 2) Fallback: reconocimiento de voz del navegador
    await startBrowserFallback();
  }, [language, startBrowserFallback]);

  const stopRecording = useCallback(() => {
    shouldRestartRef.current = false;
    if (segmentStartRef.current) {
      accumulatedMsRef.current += Date.now() - segmentStartRef.current;
      segmentStartRef.current = null;
      setDurationSeconds(Math.round(accumulatedMsRef.current / 1000));
    }
    setIsRecording(false);
    setIsSpeaking(false);
    setInterimTranscript('');

    if (realtimeSessionRef.current) {
      realtimeSessionRef.current.stop();
      realtimeSessionRef.current = null;
    }
    try { recognitionRef.current?.stop(); } catch {}
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause();
      }
    } catch {}
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    accumulatedMsRef.current = 0;
    segmentStartRef.current = null;
    setDurationSeconds(0);
    setTranscriptionSource(null);
    realtimeUnavailableRef.current = false;

    if (realtimeSessionRef.current) {
      realtimeSessionRef.current.stop();
      realtimeSessionRef.current = null;
    }

    audioChunksRef.current = [];
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch {}
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(tr => tr.stop());
      streamRef.current = null;
    }
    try { boostContextRef.current?.close(); } catch {}
    boostContextRef.current = null;
  }, []);

  // Detiene definitivamente la captura de audio y resuelve con el Blob completo
  // de la grabación (todos los segmentos combinados), para enviarlo a transcripción
  // precisa. Solo aplica cuando se usó el fallback del navegador — con ElevenLabs
  // Realtime el transcript ya es de calidad Scribe, no hace falta un blob para
  // reprocesar. Se debe llamar una sola vez, al finalizar la sesión de grabación.
  const finalizeAudio = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      const mimeType = audioMimeTypeRef.current || 'audio/webm';
      if (!recorder || recorder.state === 'inactive') {
        const blob = audioChunksRef.current.length
          ? new Blob(audioChunksRef.current, { type: mimeType })
          : null;
        resolve(blob);
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(tr => tr.stop());
          streamRef.current = null;
        }
        try { boostContextRef.current?.close(); } catch {}
        boostContextRef.current = null;
        resolve(blob);
      };
      try {
        recorder.stop();
      } catch {
        resolve(audioChunksRef.current.length ? new Blob(audioChunksRef.current, { type: mimeType }) : null);
      }
    });
  }, []);

  return {
    isRecording,
    isSpeaking,
    transcript,
    interimTranscript,
    durationSeconds,
    audioError,
    transcriptionSource,
    startRecording,
    stopRecording,
    resetTranscript,
    finalizeAudio,
  };
}
