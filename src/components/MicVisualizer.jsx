import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

export default function MicVisualizer({ isRecording, isSpeaking, wordCount }) {
  const { t } = useLanguage();
  return (
    <div className="mic-visualizer">
      <div className={`mic-orb ${isRecording ? 'active' : 'paused'} ${isSpeaking ? 'speaking' : ''}`}>
        <span className="mic-ring ring-1" />
        <span className="mic-ring ring-2" />
        <span className="mic-ring ring-3" />
        <div className="mic-core">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </div>
      </div>

      <div className="mic-bars" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={`mic-bar ${isSpeaking ? 'active' : ''}`} style={{ animationDelay: `${i * 90}ms` }} />
        ))}
      </div>

      <p className="mic-status">
        {!isRecording ? t('mic_paused') : isSpeaking ? t('mic_listening') : t('mic_waiting')}
      </p>
      {wordCount > 0 && (
        <p className="mic-wordcount text-muted">{wordCount} {t('words_captured')}</p>
      )}
    </div>
  );
}
