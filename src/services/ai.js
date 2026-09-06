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
    {
      "encabezado": "Nombre del tema principal tratado (no algo genérico como 'Resumen')",
      "puntos": ["Idea, explicación, definición o ejemplo relevante", "..."],
      "subtemas": [
        { "encabezado": "Nombre del subtema (solo si dentro del tema hay un bloque claramente diferenciado)", "puntos": ["..."] }
      ]
    }
  ],
  "puntosClave": ["Idea central 1 que resume algo importante de todo el contenido", "..."],
  "puntosImportantes": ["Contenido que el hablante enfatizó explícitamente como relevante"],
  "preguntas": [
    { "pregunta": "Posible pregunta de repaso/examen basada en el contenido", "respuesta": "Respuesta breve basada solo en la transcripción" }
  ],
  "conceptos": ["Término, autor, obra, fecha o dato puntual que conviene recordar"],
  "resumenFinal": "Un párrafo breve (3-5 frases) que sintetiza la estructura y las ideas centrales de todo el contenido",
  "acciones": ["Pendiente, tarea o cosa por confirmar mencionada o que se desprende del contenido"]
}

METODOLOGÍA — Actúa como alguien que escuchó todo el audio, lo entendió y organizó sus propios apuntes, no como quien hace un resumen superficial:

- El contenido debe salir ÚNICAMENTE de la transcripción. No agregues información externa ni conocimiento general que no se haya dicho explícitamente.
- Conserva prácticamente toda la información relevante: definiciones, explicaciones, ejemplos, comparaciones, diferencias, causas/consecuencias, clasificaciones, nombres propios, fechas y términos técnicos. Esto NO es un resumen breve — es preferible tener apuntes completos antes que un resumen demasiado corto. Prioriza siempre completitud sobre compresión.
- Organiza "secciones" por tema/bloque temático (nunca una sola sección genérica), reordenando temáticamente si eso mejora la comprensión — no hace falta respetar el orden cronológico exacto del audio.
- Usa "subtemas" únicamente cuando dentro de un tema principal exista un bloque claramente diferenciado que merezca su propio encabezado; si no aplica, deja el arreglo vacío.
- Prioriza viñetas cortas y directas sobre párrafos largos. Cada punto en "puntos" debe expresar UNA idea concreta (definición, explicación, ejemplo, dato) — no fragmentes una misma idea en varias viñetas sueltas, pero tampoco la resumas en exceso si tiene matices importantes.
- Corrige errores evidentes de una transcripción por voz (palabras deformadas, nombres propios mal transcritos) reconstruyéndolos a partir del contexto. NUNCA inventes información para "completar" algo, y nunca escribas placeholders como "[inaudible]" o "[fragmento poco claro]" — si algo no se puede reconstruir con seguridad, reformúlalo de la manera más fiel posible sin inventar contenido nuevo.
- "puntosClave": 4-8 ideas centrales de todo el contenido, cada una en una frase.
- "puntosImportantes": SOLO contenido que el hablante remarcó explícitamente (frases tipo "esto es importante", "recuerden", "ojo con...", "esto puede venir en el examen/hay que confirmarlo"). Si no hubo ningún énfasis explícito, devuelve un arreglo vacío.
- "preguntas": preguntas de repaso con respuesta basada exclusivamente en la transcripción. Si el contenido no se presta a esto (p. ej. una reunión de trabajo sin contenido educativo), devuelve un arreglo vacío — no inventes preguntas sin fundamento.
- "conceptos": nombres propios, obras, autores, teorías, fechas o términos técnicos mencionados que conviene recordar. Arreglo vacío si no aplica.
- "acciones": pendientes, tareas o cosas por confirmar/hacer mencionadas o que se desprenden del contenido (típico de reuniones de trabajo). Arreglo vacío si no aplica.
- "resumenFinal": un párrafo (3-5 frases) que permite recordar rápidamente la estructura y las ideas centrales de todo el contenido.
- Responde SOLO el JSON, sin markdown ni explicaciones.`;

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
  const prompt = `Eres un asistente que toma apuntes completos de una conversación o clase, no un resumen superficial. A continuación tienes un fragmento (parte ${index + 1} de ${total}) de una grabación más larga.

Convierte este fragmento en notas organizadas en viñetas, conservando definiciones, explicaciones, ejemplos, comparaciones, nombres propios, fechas y términos técnicos relevantes — no omitas detalles solo por acortar. Corrige errores evidentes de transcripción por voz usando el contexto (palabras deformadas, nombres mal transcritos), pero NO inventes información ni agregues datos externos. Si algo del hablante suena a énfasis explícito ("esto es importante", "recuerden", "ojo con..."), marcalo con [ÉNFASIS] al inicio de esa viñeta. Estas notas se combinarán después con las de otros fragmentos en un documento final, así que priorizá claridad y completitud, no brevedad extrema.

Fragmento:
"""
${chunk}
"""`;
  return callModel(prompt, { temperature: 0.2, reasoningEffort: 'medium' });
}

export async function analyzeTranscription(transcript) {
  validateApiKeys();

  const chunks = splitIntoChunks(transcript);

  // Caso normal: grabación corta, una sola llamada
  if (chunks.length <= 1) {
    const prompt = `Eres un asistente que transforma transcripciones en apuntes de estudio o de reunión completos, claros y bien organizados — como los haría alguien que escuchó todo el audio, lo entendió y organizó sus propias notas. No es un resumen superficial ni una reescritura literal. ${JSON_SCHEMA_INSTRUCTIONS}

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

  const finalPrompt = `Eres un asistente que transforma transcripciones en apuntes de estudio o de reunión completos, claros y bien organizados. A continuación tienes notas por bloques de una grabación larga (las líneas marcadas con [ÉNFASIS] indican algo que el hablante remarcó explícitamente como importante). Combínalas en un único documento coherente, reorganizando temáticamente cuando eso mejore la comprensión y conservando prácticamente toda la información relevante — no es un resumen breve, evita perder definiciones, ejemplos o detalles solo por acortar. Elimina únicamente repeticiones reales entre bloques. ${JSON_SCHEMA_INSTRUCTIONS}

Notas por bloques:
"""
${combinedNotes}
"""`;

  await sleep(DELAY_BETWEEN_CHUNKS_MS);
  const raw = await callModel(finalPrompt);
  return parseJsonResponse(raw);
}
