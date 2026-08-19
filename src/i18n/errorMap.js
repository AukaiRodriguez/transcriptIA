// Supabase (y otros servicios) devuelven los mensajes de error siempre en inglés,
// sin importar el idioma de la UI. Esta función traduce los mensajes conocidos
// a una clave de i18n para mostrarlos en el idioma elegido por el usuario.
// Si no reconoce el mensaje, hace un mejor esfuerzo devolviendo el mensaje original.

const PATTERNS = [
  { test: /invalid login credentials/i, key: 'err_invalid_credentials' },
  { test: /email not confirmed/i, key: 'err_email_not_confirmed' },
  { test: /user already registered|already registered|already exists/i, key: 'err_user_exists' },
  { test: /password should be at least|password.*(weak|short)/i, key: 'err_weak_password' },
  { test: /unable to validate email address|invalid email/i, key: 'err_invalid_email' },
  { test: /rate limit|too many requests/i, key: 'err_rate_limit' },
  { test: /failed to fetch|network|load failed/i, key: 'err_network' },
  { test: /signups? (are|is) disabled|signup.*disabled/i, key: 'err_signup_disabled' },
  { test: /new password should be different/i, key: 'err_same_password' },
];

/**
 * @param {Error|string|null|undefined} error - error crudo (de Supabase, fetch, etc.)
 * @param {(key: string) => string} t - función de traducción del contexto de idioma
 * @returns {string} mensaje ya traducido y listo para mostrar al usuario
 */
export function translateAuthError(error, t) {
  const message = typeof error === 'string' ? error : error?.message;
  if (!message) return t('auth_generic_error');

  const match = PATTERNS.find((p) => p.test.test(message));
  if (match) return t(match.key);

  // Fallback: no reconocemos el mensaje exacto, mostramos el original tal cual
  // (mejor un mensaje en inglés que uno vacío o genérico que oculte información útil).
  return message;
}

/**
 * Traduce errores lanzados por src/services/ai.js (instancias de AIError, con
 * `.code` y `.params`), cayendo de vuelta al mensaje crudo si no es un AIError conocido.
 * @param {Error} error
 * @param {(key: string, vars?: object) => string} t
 * @returns {string}
 */
export function translateAiError(error, t) {
  if (error?.name === 'AIError' && error.code) {
    return t(error.code, error.params);
  }
  return error?.message || t('ai_analyze_error_fallback');
}

/**
 * Traduce errores lanzados por src/services/transcribe.js (instancias de
 * TranscribeError, con `.code` y `.params`), cayendo de vuelta al mensaje
 * crudo si no es un TranscribeError conocido.
 * @param {Error} error
 * @param {(key: string, vars?: object) => string} t
 * @returns {string}
 */
export function translateTranscribeError(error, t) {
  if (error?.name === 'TranscribeError' && error.code) {
    return t(error.code, error.params);
  }
  return error?.message || t('ai_analyze_error_fallback');
}
