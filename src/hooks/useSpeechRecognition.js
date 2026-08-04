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
    };
  }, []);

  // Mantiene el idioma de reconocimiento de voz sincronizado con el idioma de la UI
  // (afecta a la próxima vez que se inicie/reinicie el reconocimiento, no a media grabación).
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = RECOGNITION_LOCALE[language] || 'es-ES';
    }
  }, [language]);

  const startRecording = useCallback(() => {
    if (!recognitionRef.current) {
      alert(t('speech_not_supported'));
      return;
    }
    shouldRestartRef.current = true;
    segmentStartRef.current = Date.now();
    setIsRecording(true);
    try { recognitionRef.current.start(); } catch {}
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
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    accumulatedMsRef.current = 0;
    segmentStartRef.current = null;
    setDurationSeconds(0);
  }, []);

  return { isRecording, isSpeaking, transcript, interimTranscript, durationSeconds, startRecording, stopRecording, resetTranscript };
}
