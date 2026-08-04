export const translations = {
  es: {
    // Auth
    auth_tagline: 'Transcripción y resúmenes con Inteligencia Artificial',
    auth_title_signup: 'Crear una cuenta',
    auth_title_signin: 'Iniciar Sesión',
    auth_email: 'Email',
    auth_password: 'Contraseña',
    auth_password_placeholder: '••••••••',
    auth_loading: 'Cargando...',
    auth_signup_btn: 'Registrarse',
    auth_signin_btn: 'Entrar',
    auth_has_account: '¿Ya tienes una cuenta? ',
    auth_no_account: '¿No tienes cuenta? ',
    auth_go_signin: 'Inicia sesión aquí',
    auth_go_signup: 'Regístrate aquí',
    auth_signup_success: 'Cuenta creada. Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.',
    auth_generic_error: 'Ocurrió un error durante la autenticación.',

    // Auth error mappings (Supabase / red)
    err_invalid_credentials: 'Correo o contraseña incorrectos.',
    err_email_not_confirmed: 'Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
    err_user_exists: 'Ya existe una cuenta con este correo.',
    err_weak_password: 'La contraseña es muy débil. Debe tener al menos 6 caracteres.',
    err_invalid_email: 'El formato del correo no es válido.',
    err_rate_limit: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
    err_network: 'No se pudo conectar. Revisa tu conexión a internet.',
    err_signup_disabled: 'El registro de nuevas cuentas está deshabilitado actualmente.',
    err_same_password: 'La nueva contraseña no puede ser igual a la anterior.',

    // Header / nav
    header_history: 'Historial',
    header_view_history: 'Ver historial',
    header_signout_hint: '(clic para salir)',

    // Home
    home_title: '¿Listo para empezar a grabar?',
    home_subtitle: 'Presiona el micrófono para comenzar la transcripción en tiempo real.',
    home_start_recording: 'Iniciar grabación',
    home_browser_hint: 'Usa Google Chrome o Edge para mejor compatibilidad.',

    // Recording / transcript
    live_badge: '● EN VIVO',
    transcript_title_live: 'Transcripción en vivo',
    transcript_title_done: 'Transcripción – Finalizada',
    btn_stop: 'Detener',
    btn_resume: 'Reanudar',
    btn_new: '✕ Nueva',
    btn_new_title: 'Cancelar y empezar de nuevo',
    show_captured_text: 'Ver texto capturado',
    hide_captured_text: 'Ocultar texto capturado',
    btn_analyze: 'Finalizar y Analizar con IA',
    words_captured: 'palabras capturadas',

    // AI error banner
    ai_error_header: '⚠️ No se pudo generar el resumen con IA',
    ai_error_hint: 'Esto suele pasar por una falla temporal del modelo gratuito — tu grabación no se perdió. Intenta de nuevo.',
    ai_retry: '↻ Reintentar análisis',
    ai_analyze_error_fallback: 'Error al analizar. Intenta de nuevo.',

    // Analyzing
    analyzing_title: 'Analizando con IA...',
    analyzing_subtitle: 'Generando título, resumen y puntos clave. Un momento.',

    // Mic status
    mic_paused: 'En pausa',
    mic_listening: 'Escuchando...',
    mic_waiting: 'Esperando sonido...',

    // Sidebar / Analysis panel
    sidebar_ai_insights: 'AI Insights',
    analysis_placeholder: 'Los insights de IA aparecerán aquí al finalizar la grabación.',
    analysis_badge_title: 'Título IA',
    download_summary_pdf: '⬇ Resumen PDF',
    download_transcript_pdf: '⬇ Transcripción PDF',
    suggested_actions: 'Acciones Sugeridas',
    new_recording: '+ Nueva Grabación',

    // History
    history_back: 'Volver',
    history_title: 'Historial de Grabaciones',
    history_count: 'grabaciones',
    history_loading: 'Cargando historial...',
    history_empty: 'Aún no tienes grabaciones guardadas.',
    history_start_new: 'Comenzar una nueva',
    history_delete_title: 'Eliminar',
    history_delete_confirm: '¿Eliminar esta transcripción?',
    history_full_transcript: 'Transcripción Completa',
    history_select_hint: 'Selecciona una grabación para ver el detalle',

    // Speech recognition
    speech_not_supported: 'Tu navegador no soporta transcripción de voz. Usa Google Chrome o Edge.',

    // AI service errors (ai.js)
    err_ai_no_key: 'API Key de OpenRouter no configurada en .env.local. Consigue una gratis en https://openrouter.ai/keys',
    err_ai_bad_key_format: 'La API Key no tiene el formato esperado de OpenRouter (debe empezar con "sk-or-"). Valor actual leído: {preview}. Revisa .env.local.',
    err_ai_rate_limit: 'Se alcanzó el límite de peticiones gratuitas de OpenRouter (20/min). Espera un minuto e intenta de nuevo.',
    err_ai_provider: 'Error de OpenRouter: {detail}',
    err_ai_no_content: 'OpenRouter no devolvió contenido en la respuesta.',
    err_ai_junk_response: 'Respuesta inválida del modelo (posible falla del proveedor gratuito): "{preview}"',
    err_ai_invalid_json: 'La IA devolvió una respuesta que no se pudo interpretar como JSON. Intenta de nuevo (si persiste, prueba grabando algo más corto). Respuesta recibida: "{preview}"',

    // Language switcher
    language: 'Idioma',
  },

  en: {
    // Auth
    auth_tagline: 'Transcription and summaries powered by Artificial Intelligence',
    auth_title_signup: 'Create an account',
    auth_title_signin: 'Sign In',
    auth_email: 'Email',
    auth_password: 'Password',
    auth_password_placeholder: '••••••••',
    auth_loading: 'Loading...',
    auth_signup_btn: 'Sign Up',
    auth_signin_btn: 'Sign In',
    auth_has_account: 'Already have an account? ',
    auth_no_account: "Don't have an account? ",
    auth_go_signin: 'Sign in here',
    auth_go_signup: 'Sign up here',
    auth_signup_success: 'Account created. Check your email to confirm your account before signing in.',
    auth_generic_error: 'An error occurred during authentication.',

    // Auth error mappings (Supabase / network)
    err_invalid_credentials: 'Incorrect email or password.',
    err_email_not_confirmed: 'You need to confirm your email before signing in. Check your inbox.',
    err_user_exists: 'An account with this email already exists.',
    err_weak_password: 'The password is too weak. It must be at least 6 characters long.',
    err_invalid_email: 'The email format is not valid.',
    err_rate_limit: 'Too many attempts. Please wait a few minutes and try again.',
    err_network: 'Could not connect. Check your internet connection.',
    err_signup_disabled: 'New account sign-ups are currently disabled.',
    err_same_password: 'The new password cannot be the same as the previous one.',

    // Header / nav
    header_history: 'History',
    header_view_history: 'View history',
    header_signout_hint: '(click to sign out)',

    // Home
    home_title: 'Ready to start recording?',
    home_subtitle: 'Press the microphone to start real-time transcription.',
    home_start_recording: 'Start recording',
    home_browser_hint: 'Use Google Chrome or Edge for best compatibility.',

    // Recording / transcript
    live_badge: '● LIVE',
    transcript_title_live: 'Live transcription',
    transcript_title_done: 'Transcription – Finished',
    btn_stop: 'Stop',
    btn_resume: 'Resume',
    btn_new: '✕ New',
    btn_new_title: 'Cancel and start over',
    show_captured_text: 'Show captured text',
    hide_captured_text: 'Hide captured text',
    btn_analyze: 'Finish and Analyze with AI',
    words_captured: 'words captured',

    // AI error banner
    ai_error_header: '⚠️ Could not generate the AI summary',
    ai_error_hint: 'This is usually caused by a temporary failure of the free model — your recording was not lost. Try again.',
    ai_retry: '↻ Retry analysis',
    ai_analyze_error_fallback: 'Error analyzing. Please try again.',

    // Analyzing
    analyzing_title: 'Analyzing with AI...',
    analyzing_subtitle: 'Generating title, summary, and key points. One moment.',

    // Mic status
    mic_paused: 'Paused',
    mic_listening: 'Listening...',
    mic_waiting: 'Waiting for sound...',

    // Sidebar / Analysis panel
    sidebar_ai_insights: 'AI Insights',
    analysis_placeholder: 'AI insights will appear here once the recording is finished.',
    analysis_badge_title: 'AI Title',
    download_summary_pdf: '⬇ Summary PDF',
    download_transcript_pdf: '⬇ Transcript PDF',
    suggested_actions: 'Suggested Actions',
    new_recording: '+ New Recording',

    // History
    history_back: 'Back',
    history_title: 'Recording History',
    history_count: 'recordings',
    history_loading: 'Loading history...',
    history_empty: "You don't have any saved recordings yet.",
    history_start_new: 'Start a new one',
    history_delete_title: 'Delete',
    history_delete_confirm: 'Delete this transcription?',
    history_full_transcript: 'Full Transcript',
    history_select_hint: 'Select a recording to view its details',

    // Speech recognition
    speech_not_supported: "Your browser doesn't support speech transcription. Use Google Chrome or Edge.",

    // AI service errors (ai.js)
    err_ai_no_key: 'OpenRouter API Key not configured in .env.local. Get a free one at https://openrouter.ai/keys',
    err_ai_bad_key_format: 'The API Key does not have the expected OpenRouter format (it must start with "sk-or-"). Current value read: {preview}. Check .env.local.',
    err_ai_rate_limit: "OpenRouter's free request limit was reached (20/min). Wait a minute and try again.",
    err_ai_provider: 'OpenRouter error: {detail}',
    err_ai_no_content: 'OpenRouter did not return any content in the response.',
    err_ai_junk_response: 'Invalid response from the model (possible failure of the free provider): "{preview}"',
    err_ai_invalid_json: 'The AI returned a response that could not be parsed as JSON. Try again (if it persists, try recording something shorter). Response received: "{preview}"',

    // Language switcher
    language: 'Language',
  },
};

export const LOCALE_MAP = { es: 'es-ES', en: 'en-US' };
