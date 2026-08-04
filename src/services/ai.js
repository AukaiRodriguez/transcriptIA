const OPENROUTER_API_KEY = (import.meta.env.VITE_OPENROUTER_API_KEY || '').trim();

// Error con código traducible: los textos legibles para el usuario se resuelven
// en la UI según el idioma elegido (ver src/i18n), en vez de quedar fijos en español.
export class AIError extends Error {
  constructor(code, params = {}) {
    super(code);
    this.name = 'AIError';
    this.code = code;
    this.params = params;
  }
}

function maskedKeyPreview() {
  if (!OPENROUTER_API_KEY) return '(vacía)';
  return `${OPENROUTER_API_KEY.slice(0, 8)}...${OPENROUTER_API_KEY.slice(-4)} (${OPENROUTER_API_KEY.length} caracteres)`;
}

function validateApiKey() {
  if (!OPENROUTER_API_KEY) {
    throw new AIError('err_ai_no_key');
  }
  if (!OPENROUTER_API_KEY.startsWith('sk-or-')) {
    throw new AIError('err_ai_bad_key_format', { preview: maskedKeyPreview() });
  }
}

// "openrouter/free" es un router que selecciona automáticamente entre los modelos
// gratuitos disponibles en OpenRouter en cada momento. Evita hardcodear un modelo
// específico (ej. Gemini) que puede dejar de ser gratis o desaparecer sin aviso.
const MODEL_FREE = "openrouter/free";

// Umbral: por debajo de esto se analiza en una sola llamada (caso normal)
const WORDS_PER_CHUNK = 3500;

// El límite gratuito de OpenRouter es 20 peticiones/minuto combinadas entre todos
// los modelos free. Con este intervalo nos quedamos por debajo con margen.
const DELAY_BETWEEN_CHUNKS_MS = 3500;

const JSON_SCHEMA_INSTRUCTIONS = `Devuelve un JSON estricto con estas claves exactas:
{
  "titulo": "Título descriptivo y conciso de máximo 8 palabras",
  "idioma": "es o en dependiendo del idioma detectado",
  "secciones": [
    { "encabezado": "Nombre del tema tratado", "puntos": ["idea 1 explicada con su contexto", "idea 2 explicada con su contexto", "..."] }
  ],
  "acciones": ["Acción o pendiente sugerido 1", "Acción o pendiente sugerido 2"]
}

Reglas:
- Organiza el contenido en 2-5 "secciones" por tema/bloque temático tratado (no una sola sección genérica). El "encabezado" debe nombrar el tema concreto, no algo genérico como "Resumen".
- Cada punto en "puntos" debe expresar una IDEA completa con su contexto (qué se planteó y por qué importa), no un dato o frase suelta sacada literalmente de la transcripción. Sintetiza el razonamiento con tus propias palabras — evita que el punto quede sin sentido si se lee aislado.
- No fragmentes una misma idea en varios puntos sueltos; agrupa lo relacionado en un solo punto bien redactado.
- "acciones" son pendientes, tareas o cosas por confirmar/estudiar que se mencionaron o se desprenden del contenido. Si no hay ninguna, devuelve un arreglo vacío.
- Si hay partes incomprensibles, intenta completarlas con contexto lógico
- Responde SOLO el JSON, sin markdown ni explicaciones`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOpenRouter(prompt, { temperature = 0.3 } = {}) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:5173",
      "X-Title": "TranscripIA"
    },
    body: JSON.stringify({
      model: MODEL_FREE,
      messages: [{ role: "user", content: prompt }],
      temperature,
    })
  });

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 429) {
      throw new AIError('err_ai_rate_limit');
    }
    throw new AIError('err_ai_provider', { detail: err });
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new AIError('err_ai_no_content');
  }
  return text;
}

// Detecta respuestas "basura" que a veces devuelven algunos modelos gratuitos del
// router (ej. metadata interna de moderación tipo "User Safety: safe" en vez del
// contenido pedido). No es un error de tu transcripción, es una falla del modelo.
function looksLikeJunk(text) {
  const t = text.trim();
  if (t.length < 15) return true;
  if (/^user safety/i.test(t)) return true;
  if (/^(safety|moderation|content policy)[\s:]/i.test(t)) return true;
  return false;
}

// Reintenta la llamada si la respuesta viene vacía/basura — como el router elige
// un modelo distinto en cada intento, un reintento suele resolverlo solo.
async function callOpenRouterWithRetry(prompt, options = {}, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const text = await callOpenRouter(prompt, options);
      if (looksLikeJunk(text)) {
        throw new AIError('err_ai_junk_response', { preview: text.trim().slice(0, 100) });
      }
      return text;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await sleep(1500);
      }
    }
  }
  throw lastError;
}

function parseJsonResponse(raw) {
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  // Intento directo: el modelo respondió solo JSON, como se le pidió
  try {
    return JSON.parse(clean);
  } catch {
    // sigue abajo
  }

  // Intento tolerante: extraer el bloque { ... } aunque venga rodeado de texto
  // (algunos modelos gratuitos no siguen al pie de la letra "responde solo JSON")
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(clean.slice(start, end + 1));
    } catch {
      // sigue abajo
    }
  }

  const preview = clean.slice(0, 250) + (clean.length > 250 ? '...' : '');
  throw new AIError('err_ai_invalid_json', { preview });
}

// Divide la transcripción en bloques de ~WORDS_PER_CHUNK palabras,
// respetando límites de espacio para no cortar palabras a la mitad.
function splitIntoChunks(transcript, wordsPerChunk = WORDS_PER_CHUNK) {
  const words = transcript.trim().split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(' '));
  }
  return chunks;
}

// Resume un bloque en notas condensadas (mucho más rápido/liviano que reenviar el bloque completo)
async function summarizeChunk(chunk, index, total) {
  const prompt = `Eres un asistente que capta el sentido y los argumentos de una conversación, no solo transcribe datos sueltos. A continuación tienes un fragmento (parte ${index + 1} de ${total}) de una grabación más larga.

Identifica las ideas y el razonamiento principal de este fragmento: qué se planteó, por qué, y cómo se relacionan los puntos entre sí. Escribe notas en viñetas que expliquen cada idea con su contexto — no extraigas frases o datos aislados sin explicar su sentido. No inventes información que no esté en el texto. Sé breve pero completo.

Fragmento:
"""
${chunk}
"""`;
  return callOpenRouterWithRetry(prompt, { temperature: 0.2 });
}

export async function analyzeTranscription(transcript) {
  validateApiKey();

  const chunks = splitIntoChunks(transcript);

  // Caso normal: grabación corta, una sola llamada
  if (chunks.length <= 1) {
    const prompt = `Eres un asistente que entiende el sentido y los argumentos de una conversación o clase, no solo transcribe datos sueltos. Tu tarea es identificar las ideas principales y el razonamiento detrás de lo que se dijo, conectando cada punto con su contexto, para que alguien que no escuchó el audio entienda de qué trató y por qué importa cada parte. ${JSON_SCHEMA_INSTRUCTIONS}

Transcripción:
"""
${transcript}
"""`;
    const raw = await callOpenRouterWithRetry(prompt);
    return parseJsonResponse(raw);
  }

  // Grabación larga: resume cada bloque por separado (map), luego combina las notas
  // en el análisis final (reduce). Llamadas en secuencia y con pausa entre ellas
  // para respetar el límite de 20 peticiones/minuto del nivel gratuito.
  const chunkSummaries = [];
  for (let i = 0; i < chunks.length; i++) {
    chunkSummaries.push(await summarizeChunk(chunks[i], i, chunks.length));
    if (i < chunks.length - 1) {
      await sleep(DELAY_BETWEEN_CHUNKS_MS);
    }
  }

  const combinedNotes = chunkSummaries
    .map((s, i) => `--- Bloque ${i + 1} ---\n${s}`)
    .join('\n\n');

  const finalPrompt = `Eres un asistente que entiende el sentido y los argumentos de una conversación o clase, no solo transcribe datos sueltos. A continuación tienes notas condensadas de una grabación larga, divididas en bloques cronológicos. Combínalas en un único análisis coherente, conectando las ideas relacionadas entre bloques y explicando el razonamiento detrás de cada tema. ${JSON_SCHEMA_INSTRUCTIONS}

Notas por bloques:
"""
${combinedNotes}
"""`;

  await sleep(DELAY_BETWEEN_CHUNKS_MS);
  const raw = await callOpenRouterWithRetry(finalPrompt);
  return parseJsonResponse(raw);
}
