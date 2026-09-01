const GROQ_API_KEY = (import.meta.env.VITE_GROQ_API_KEY || '').trim();
const OPENROUTER_API_KEY = (import.meta.env.VITE_OPENROUTER_API_KEY || '').trim();

// Modelo principal: Groq sirve openai/gpt-oss-120b con inferencia muy rápida y
// buena calidad para este tipo de análisis. Si no hay key de Groq, o si Groq
// falla por cualquier motivo (sin cuota, error de red, etc.), cada llamada cae
// automáticamente al conjunto de modelos gratuitos de OpenRouter (ver callModel).
const GROQ_MODEL = 'openai/gpt-oss-120b';

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

function validateApiKeys() {
  if (!GROQ_API_KEY && !OPENROUTER_API_KEY) {
    throw new AIError('err_ai_no_key');
  }
  // Si hay OpenRouter configurado (como respaldo o único proveedor), validamos
  // su formato — un typo aquí produciría fallos silenciosos en el fallback.
  if (OPENROUTER_API_KEY && !OPENROUTER_API_KEY.startsWith('sk-or-')) {
    throw new AIError('err_ai_bad_key_format', { preview: maskedKeyPreview() });
  }
}

// "openrouter/free" NO es un modelo real de OpenRouter — los modelos gratis
// requieren un ID específico terminado en ":free" (ej. "meta-llama/llama-3.3-70b-instruct:free").
// Usar un ID inexistente hace que OpenRouter falle o devuelva respuestas de mala calidad,
// que es justo el síntoma reportado (resúmenes malos / errores intermitentes).
// En su lugar, probamos una lista de modelos gratuitos reales y confiables, en orden
// de calidad, y pasamos al siguiente si uno falla, está caído o da respuesta basura.
const FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-chat-v3.1:free",
  "qwen/qwen3-235b-a22b:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
];

// Umbral: por debajo de esto se analiza en una sola llamada (caso normal)
const WORDS_PER_CHUNK = 3500;

// El límite gratuito de OpenRouter es 20 peticiones/minuto combinadas entre todos
// los modelos free. Si además hay Groq configurado, espaciamos más las llamadas
// porque su nivel gratuito tiene un límite de ~8,000 tokens/minuto para
// openai/gpt-oss-120b — bastante ajustado para bloques de este tamaño. Si aun así
// se excede, esa llamada puntual cae a OpenRouter automáticamente (ver callModel),
// así que este delay solo reduce cuántas veces pasa eso, no lo garantiza.
const DELAY_BETWEEN_CHUNKS_MS = GROQ_API_KEY ? 6000 : 3500;

const JSON_SCHEMA_INSTRUCTIONS = `Devuelve un JSON estricto con estas claves exactas:
{
  "titulo": "Título descriptivo y conciso de máximo 8 palabras",
  "idioma": "es o en dependiendo del idioma detectado",
  "secciones": [
    { "encabezado": "Nombre del tema tratado", "puntos": ["idea 1 en una frase corta", "idea 2 en una frase corta", "..."] }
  ],
  "acciones": ["Acción o pendiente sugerido 1", "Acción o pendiente sugerido 2"]
}

Reglas de CONTENIDO:
- Organiza el contenido en 2-4 "secciones" por tema/bloque temático tratado (no una sola sección genérica). El "encabezado" debe nombrar el tema concreto, no algo genérico como "Resumen".
- Cada punto en "puntos" debe capturar UNA idea concreta y su porqué en una sola frase — ve directo a lo esencial, sin rodeos ni repetir contexto ya dado en otro punto.
- No fragmentes una misma idea en varios puntos sueltos; agrupa lo relacionado en un solo punto.
- "acciones" son pendientes, tareas o cosas por confirmar/estudiar que se mencionaron o se desprenden del contenido. Si no hay ninguna, devuelve un arreglo vacío.
- Si hay partes incomprensibles, intenta completarlas con contexto lógico.

Reglas de LONGITUD (muy importantes — este es un resumen ejecutivo, no una reescritura):
- Máximo 3-5 puntos por sección. Si el tema tiene más ideas, elige solo las más importantes.
- Cada punto: máximo 25 palabras (una o dos frases). Si se te ocurre una explicación más larga, recórtala a lo esencial.
- Máximo 4 acciones, cada una en una frase corta.
- El resultado completo debe ser considerablemente MÁS CORTO que la transcripción original. Prioriza siempre compresión sobre exhaustividad: es preferible omitir un detalle menor antes que alargar un punto.
- Responde SOLO el JSON, sin markdown ni explicaciones`;

async function callGroq(prompt, { temperature = 0.3, reasoningEffort = 'medium' } = {}) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      // 'low' es suficiente para extracción/resumen (no requiere razonamiento
      // profundo) y consume menos tokens — ayuda a rendir mejor dentro del
      // límite de tokens/minuto del nivel gratuito de Groq.
      reasoning_effort: reasoningEffort,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    if (response.status === 401) throw new AIError('err_ai_groq_auth');
    if (response.status === 429) throw new AIError('err_ai_groq_rate_limit');
    throw new AIError('err_ai_groq_provider', { detail });
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new AIError('err_ai_no_content');
  if (looksLikeJunk(text)) {
    throw new AIError('err_ai_junk_response', { preview: text.trim().slice(0, 100) });
  }
  return text;
}

// Punto único de entrada para pedirle algo al modelo: intenta primero con Groq
// (openai/gpt-oss-120b) si hay key configurada; si Groq falla por cualquier
// razón (sin cuota, error de red, rate limit, etc.) cae automáticamente al
// conjunto de modelos gratuitos de OpenRouter como respaldo. Si no hay key de
// Groq, va directo al respaldo gratuito.
async function callModel(prompt, options = {}) {
  if (GROQ_API_KEY) {
    try {
      return await callGroq(prompt, options);
    } catch (err) {
      console.warn('Groq falló, usando respaldo gratuito de OpenRouter:', err.message);
    }
  }
  return callOpenRouterWithRetry(prompt, options);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOpenRouter(prompt, { temperature = 0.3, model } = {}) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:5173",
      "X-Title": "TranscriptIA"
    },
    body: JSON.stringify({
      model,
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

// Reintenta la llamada si la respuesta viene vacía/basura o el modelo falla —
// en cada intento se prueba con el siguiente modelo gratuito de la lista, así que
// si uno está caído, saturado, o da basura, el intento siguiente usa uno distinto.
async function callOpenRouterWithRetry(prompt, options = {}, models = FREE_MODELS) {
  let lastError;
  for (let i = 0; i < models.length; i++) {
    try {
      const text = await callOpenRouter(prompt, { ...options, model: models[i] });
      if (looksLikeJunk(text)) {
        throw new AIError('err_ai_junk_response', { preview: text.trim().slice(0, 100) });
      }
      return text;
    } catch (err) {
      lastError = err;
      if (i < models.length - 1) {
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

Identifica SOLO las ideas más importantes de este fragmento (no todas, prioriza) y su porqué, en notas breves tipo viñeta de una frase cada una. No expliques de más ni repitas contexto — estas notas se combinarán después con las de otros fragmentos, así que la brevedad aquí es clave. No inventes información que no esté en el texto.

Fragmento:
"""
${chunk}
"""`;
  return callModel(prompt, { temperature: 0.2, reasoningEffort: 'low' });
}

export async function analyzeTranscription(transcript) {
  validateApiKeys();

  const chunks = splitIntoChunks(transcript);

  // Caso normal: grabación corta, una sola llamada
  if (chunks.length <= 1) {
    const prompt = `Eres un asistente que hace resúmenes ejecutivos: capta el sentido y los argumentos de una conversación o clase, pero los expresa de forma MUY concisa — no es una reescritura ni una explicación extendida, es una compilación de ideas y puntos específicos en el menor texto posible. ${JSON_SCHEMA_INSTRUCTIONS}

Transcripción:
"""
${transcript}
"""`;
    const raw = await callModel(prompt);
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

  const finalPrompt = `Eres un asistente que hace resúmenes ejecutivos: capta el sentido y los argumentos de una conversación o clase, pero los expresa de forma MUY concisa. A continuación tienes notas condensadas de una grabación larga, divididas en bloques cronológicos. Combínalas en un único análisis coherente y BREVE, conectando las ideas relacionadas entre bloques sin repetir ni extenderte. ${JSON_SCHEMA_INSTRUCTIONS}

Notas por bloques:
"""
${combinedNotes}
"""`;

  await sleep(DELAY_BETWEEN_CHUNKS_MS);
  const raw = await callModel(finalPrompt);
  return parseJsonResponse(raw);
}
