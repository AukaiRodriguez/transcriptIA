import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';

const RECOGNITION_LOCALE = { es: 'es-ES', en: 'en-US' };

export function useSpeechRecognition() {
  const { language, t } = useLanguage();
  const [isRecording, setIsRecording]         = useState(false);
  const [isSpeaking, setIsSpeaking]           = useState(false);
  const [transcript, setTranscript]           = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const recognitionRef = useRef(null);
  const shouldRestartRef = useRef(false);
  const segmentStartRef = useRef(null);
  const accumulatedMsRef = useRef(0);

  // Captura del audio real (en paralelo a la transcripción en vivo del navegador),
  // para poder mandarlo después a un servicio de STT más preciso (ver services/transcribe.js).
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  // Build recognition instance once
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
      if (event.error === 'no-speech') return; // normal – ignore
      console.error('Speech recognition error:', event.error);
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

  const startRecording = useCallback(async () => {
    if (!recognitionRef.current) {
      alert(t('speech_not_supported'));
      return;
    }
    shouldRestartRef.current = true;
    segmentStartRef.current = Date.now();
    setIsRecording(true);
    try { recognitionRef.current.start(); } catch {}

    // Grabación de audio real para transcripción precisa post-grabación.
    // No bloquea la transcripción en vivo si falla (ej. permiso denegado):
    // simplemente no habrá mejora de precisión al finalizar.
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
      } else if (!mediaRecorderRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        mediaRecorderRef.current = recorder;
        recorder.start(1000);
      }
    } catch (err) {
      console.error('No se pudo iniciar la grabación de audio para transcripción precisa:', err);
    }
  }, [t]);

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
  }, []);

  // Detiene definitivamente la captura de audio y resuelve con el Blob completo
  // de la grabación (todos los segmentos combinados), para enviarlo a transcripción
  // precisa. Se debe llamar una sola vez, al finalizar la sesión de grabación.
  const finalizeAudio = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        const blob = audioChunksRef.current.length
          ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
          : null;
        resolve(blob);
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(tr => tr.stop());
          streamRef.current = null;
        }
        resolve(blob);
      };
      try {
        recorder.stop();
      } catch {
        resolve(audioChunksRef.current.length ? new Blob(audioChunksRef.current, { type: 'audio/webm' }) : null);
      }
    });
  }, []);

  return {
    isRecording,
    isSpeaking,
    transcript,
    interimTranscript,
    durationSeconds,
    startRecording,
    stopRecording,
    resetTranscript,
    finalizeAudio,
  };
}
