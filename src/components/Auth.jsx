import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { useLanguage } from '../i18n/LanguageContext';
import { translateAuthError } from '../i18n/errorMap';
import LanguageSwitcher from './LanguageSwitcher';

export default function Auth() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      let data, error;
      if (isSignUp) {
        ({ data, error } = await supabase.auth.signUp({ email, password }));
      } else {
        ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
      }

      if (error) throw error;

      // Si Supabase requiere confirmación por correo, no se crea sesión todavía
      if (isSignUp && data?.user && !data?.session) {
        setInfo(t('auth_signup_success'));
      }
      // Si hay sesión, App.jsx la detecta automáticamente vía supabase.auth.onAuthStateChange
    } catch (err) {
      setError(translateAuthError(err, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Panel visual de marca (oculto en pantallas angostas) */}
      <div className="auth-hero">
        <div className="auth-hero-glow" aria-hidden="true" />
        <div className="auth-hero-content">
          <img src="/logo.png" alt="TranscriptIA" className="auth-hero-logo" />
          <h1 className="auth-hero-name">TranscriptIA</h1>
          <span className="auth-hero-subtitle">Aukai Labs</span>
          <p className="auth-hero-tagline">{t('auth_tagline')}</p>
          <ul className="auth-hero-features">
            <li>
              <span className="auth-hero-feature-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              {t('auth_feature_1')}
            </li>
            <li>
              <span className="auth-hero-feature-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              {t('auth_feature_2')}
            </li>
            <li>
              <span className="auth-hero-feature-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              {t('auth_feature_3')}
            </li>
          </ul>
        </div>
      </div>

      {/* Panel de formulario */}
      <div className="auth-form-panel">
        <div className="auth-top-row">
          <LanguageSwitcher />
        </div>

        <div className="auth-form-wrap">
          <div className="auth-form-card">
            <img src="/logo.png" alt="TranscriptIA" className="auth-form-logo" />
            <h2>{isSignUp ? t('auth_title_signup') : t('auth_title_signin')}</h2>
            <p className="auth-form-subtitle text-muted">
              {isSignUp ? t('auth_signup_subtitle') : t('auth_signin_subtitle')}
            </p>

            {error && <div className="auth-error">{error}</div>}
            {info && <div className="auth-info">{info}</div>}

            <form onSubmit={handleAuth} className="auth-form">
              <div className="form-group">
                <label htmlFor="email">{t('auth_email')}</label>
                <input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="glass-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">{t('auth_password')}</label>
                <input
                  id="password"
                  type="password"
                  placeholder={t('auth_password_placeholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="glass-input"
                />
              </div>
              <button type="submit" className="btn-primary auth-submit" disabled={loading}>
                {loading ? t('auth_loading') : (isSignUp ? t('auth_signup_btn') : t('auth_signin_btn'))}
              </button>
            </form>

            <p className="auth-switch text-muted">
              {isSignUp ? t('auth_has_account') : t('auth_no_account')}
              <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="btn-link">
                {isSignUp ? t('auth_go_signin') : t('auth_go_signup')}
              </button>
            </p>
          </div>
        </div>

        <footer className="app-footer auth-footer">
          <p>&copy; {new Date().getFullYear()} Aukai Labs</p>
        </footer>
      </div>
    </div>
  );
}
