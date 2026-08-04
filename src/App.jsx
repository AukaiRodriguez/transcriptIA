import React, { useState, useEffect } from 'react';
import './index.css';
import Auth from './components/Auth';
import AnalysisPanel from './components/AnalysisPanel';
import History from './components/History';
import MicVisualizer from './components/MicVisualizer';
import LanguageSwitcher from './components/LanguageSwitcher';
import { supabase } from './services/supabase';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { analyzeTranscription } from './services/ai';
import { saveTranscription } from './services/db';
import { formatDuration } from './utils/format';
import { useLanguage } from './i18n/LanguageContext';
import { translateAiError } from './i18n/errorMap';

// view states: 'home' | 'recording' | 'analyzing' | 'done' | 'history'

function App() {
  const { t, locale } = useLanguage();
  const [session, setSession] = useState(null);
  const [view, setView] = useState('home');
  const [analysis, setAnalysis] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [analyzedAt, setAnalyzedAt] = useState(null);
  const [showText, setShowText] = useState(false);

  const {
    isRecording,
    isSpeaking,
    transcript,
    interimTranscript,
    durationSeconds,
    startRecording,
    stopRecording,
    resetTranscript,
  } = useSpeechRecognition();

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleStart = () => {
    setAnalysis(null);
    setAiError(null);
    resetTranscript();
    setView('recording');
    startRecording();
  };

  const handleResume = () => {
    // A diferencia de handleStart, NO resetea el transcript: sigue acumulando
    // sobre lo que ya se había grabado antes de pausar.
    setAiError(null);
    startRecording();
  };

  const handleStop = () => {
    stopRecording();
    // stays in 'recording' view but isRecording=false → shows Analyze button
  };

  const handleAnalyze = async () => {
    if (!transcript.trim()) return;
    setView('analyzing');
    try {
      const result = await analyzeTranscription(transcript);
      setAnalysis(result);
      setAnalyzedAt(new Date());

      // Save to Supabase
      await saveTranscription({
        userId: session.user.id,
        title: result.titulo,
        rawTranscript: transcript,
        secciones: result.secciones,
        acciones: result.acciones,
        durationSeconds,
        language: result.idioma || 'es',
      });

      setView('done');
    } catch (err) {
      console.error('AI Error:', err);
      setAiError(translateAiError(err, t));
      setView('recording');
    }
  };

  const handleNewMeeting = () => {
    resetTranscript();
    setAnalysis(null);
    setAiError(null);
    setAnalyzedAt(null);
    setView('home');
  };

  // ─── Auth gate ───────────────────────────────────────────────────────────────
  if (!session) return <Auth />;

  // ─── History view ─────────────────────────────────────────────────────────
  if (view === 'history') return (
    <div id="root-inner">
      <History userId={session.user.id} onBack={() => setView('home')} />
    </div>
  );

  // ─── Main view ────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      {/* Header */}
      <header className="glass-panel header">
        <h1>TranscripIA</h1>
        <nav className="header-nav">
          <LanguageSwitcher />
          <button
            className="btn-nav"
            onClick={() => setView('history')}
            title={t('header_view_history')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            {t('header_history')}
          </button>
          <div
            className="avatar"
            title={`${session.user.email}\n${t('header_signout_hint')}`}
            onClick={() => supabase.auth.signOut()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
        </nav>
      </header>

      {/* Body */}
      <main className="main-content">
        {/* Transcription panel */}
        <section className="transcription-area glass-panel">

          {/* ── HOME ── */}
          {view === 'home' && (
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </div>
              <h2>{t('home_title')}</h2>
              <p className="text-muted">{t('home_subtitle')}</p>
              <button className="record-btn" onClick={handleStart} title={t('home_start_recording')}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </button>
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                {t('home_browser_hint')}
              </p>
            </div>
          )}

          {/* ── RECORDING / DONE ── */}
          {(view === 'recording' || view === 'done') && (
            <div className="transcript-display">
              {/* Toolbar */}
              <div className="transcript-toolbar">
                <div className="toolbar-left">
                  {isRecording && <span className="live-badge">{t('live_badge')}</span>}
                  <h2 className="transcript-title">{view === 'done' ? t('transcript_title_done') : t('transcript_title_live')}</h2>
                </div>
                <div className="toolbar-right">
                  {view !== 'done' && (
                    <button
                      className={`btn-record-toggle ${isRecording ? 'stop' : 'resume'}`}
                      onClick={isRecording ? handleStop : handleResume}
                    >
                      {isRecording ? t('btn_stop') : t('btn_resume')}
                    </button>
                  )}
                  <button className="btn-ghost" onClick={handleNewMeeting} title={t('btn_new_title')}>
                    {t('btn_new')}
                  </button>
                </div>
              </div>

              {/* Error */}
              {aiError && (
                <div className="ai-error-banner">
                  <div className="ai-error-header">{t('ai_error_header')}</div>
                  <p className="ai-error-detail">{aiError}</p>
                  <p className="ai-error-hint">
                    {t('ai_error_hint')}
                  </p>
                  <button className="btn-primary btn-retry" onClick={handleAnalyze}>
                    {t('ai_retry')}
                  </button>
                </div>
              )}

              {/* Mic visualizer (en vez de mostrar el texto crudo) */}
              <div className="transcript-scroll mic-scroll">
                <MicVisualizer
                  isRecording={isRecording}
                  isSpeaking={isSpeaking}
                  wordCount={transcript.trim() ? transcript.trim().split(/\s+/).length : 0}
                />
              </div>

              {/* Toggle opcional para revisar el texto capturado antes de analizar */}
              {transcript && (
                <div className="transcript-toggle-row">
                  <button className="btn-link" onClick={() => setShowText(s => !s)}>
                    {showText ? t('hide_captured_text') : t('show_captured_text')}
                  </button>
                  {showText && (
                    <div className="transcript-text-reveal">
                      <span className="transcript-final">{transcript}</span>
                      {interimTranscript && <span className="transcript-interim"> {interimTranscript}</span>}
                    </div>
                  )}
                </div>
              )}

              {/* Analyze button */}
              {!isRecording && view !== 'done' && transcript && (
                <div className="transcript-footer">
                  <button className="btn-primary btn-analyze" onClick={handleAnalyze}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                    {t('btn_analyze')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── ANALYZING ── */}
          {view === 'analyzing' && (
            <div className="empty-state">
              <div className="analyzing-spinner">
                <div className="spinner-ring"/>
              </div>
              <h2>{t('analyzing_title')}</h2>
              <p className="text-muted">{t('analyzing_subtitle')}</p>
            </div>
          )}
        </section>

        {/* Sidebar */}
        <aside className="sidebar glass-panel">
          <h3 className="sidebar-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            {t('sidebar_ai_insights')}
          </h3>
          <AnalysisPanel
            analysis={analysis}
            transcript={transcript}
            meta={{
              dateLabel: analyzedAt ? analyzedAt.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : null,
              durationLabel: formatDuration(durationSeconds),
            }}
            onNewMeeting={view === 'done' ? handleNewMeeting : null}
          />
        </aside>
      </main>
    </div>
  );
}

export default App;
