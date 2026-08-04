import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { translations, LOCALE_MAP } from './translations';

const STORAGE_KEY = 'transcripia_lang';
const SUPPORTED = ['es', 'en'];

function detectInitialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
  } catch {
    // localStorage no disponible (modo privado, etc.) — seguimos con el idioma del navegador
  }
  const browserLang = (navigator.language || 'es').slice(0, 2).toLowerCase();
  return SUPPORTED.includes(browserLang) ? browserLang : 'es';
}

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(detectInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang) => {
    if (!SUPPORTED.includes(lang)) return;
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignorar si no se puede persistir
    }
  }, []);

  const t = useCallback((key, vars) => {
    const dict = translations[language] || translations.es;
    let str = dict[key] ?? translations.es[key] ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replaceAll(`{${k}}`, v);
      });
    }
    return str;
  }, [language]);

  const locale = LOCALE_MAP[language] || 'es-ES';

  const value = useMemo(() => ({ language, setLanguage, t, locale, supported: SUPPORTED }), [language, setLanguage, t, locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage debe usarse dentro de un LanguageProvider');
  return ctx;
}
