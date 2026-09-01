# TranscriptIA

Transcribe reuniones/clases en vivo y genera un resumen estructurado (secciones + acciones sugeridas) con IA, exportable a PDF. Corre 100% en el navegador (React + Vite), sin backend propio.

## Configuración

Copia `.env.example` a `.env.local` y completa:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_GROQ_API_KEY=...          # opcional, recomendado
VITE_OPENROUTER_API_KEY=...    # opcional, respaldo gratuito
VITE_ELEVENLABS_API_KEY=...    # opcional, transcripción de alta precisión
```

Luego:

```bash
npm install
npm run dev
```

Corre el script `supabase-setup.sql` en el SQL Editor de tu proyecto de Supabase antes del primer uso (crea la tabla `transcriptions` con Row Level Security).

## Proveedores y fallbacks

**Transcripción de voz** (`src/services/realtimeTranscribe.js`, `src/hooks/useSpeechRecognition.js`):
1. Si `VITE_ELEVENLABS_API_KEY` está configurada → **ElevenLabs Scribe v2 Realtime** (WebSocket, transcripción en vivo de alta precisión, ~150ms de latencia).
2. Si no está configurada, o falla al conectar → **Web Speech API del navegador** (gratis, integrada, funciona en Chrome/Edge; no requiere key). En este modo, al finalizar la grabación se intenta además una mejora con **ElevenLabs Scribe v2 (batch)** si la key está disponible (`src/services/transcribe.js`).

**Resumen con IA** (`src/services/ai.js`):
1. Si `VITE_GROQ_API_KEY` está configurada → **Groq** con el modelo `openai/gpt-oss-120b` (rápido, buena calidad; nivel gratuito con límites de tasa, ver [groq.com/pricing](https://groq.com/pricing)).
2. Si no está configurada, o Groq falla (sin cuota, error de red, etc.) → **OpenRouter**, probando una lista de modelos gratuitos (`:free`) en orden hasta que uno responda.
3. Si ninguna key está configurada, la app muestra un error explicando cómo obtener una gratis de cada servicio.

Todas las claves se usan directamente desde el navegador (`VITE_*` = expuestas en el bundle público). Es el mismo modelo que usan Supabase (clave anónima, protegida por RLS) y el resto de integraciones de este proyecto — no hay backend propio que las oculte. Si esto se convierte en un producto con más usuarios, lo recomendable es mover estas llamadas detrás de un backend/proxy propio para no exponer las keys ni sus límites de cuota directamente al cliente.

## Stack

React 19 + Vite · Supabase (auth + base de datos) · jsPDF (exportación) · oxlint

---

<details>
<summary>Plantilla original de Vite (referencia)</summary>

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules. Two official plugins are available: `@vitejs/plugin-react` (uses [Oxc](https://oxc.rs)) and `@vitejs/plugin-react-swc` (uses [SWC](https://swc.rs/)). The React Compiler is not enabled on this template — see [this documentation](https://react.dev/learn/react-compiler/installation) to add it. If developing a production application, consider TypeScript with type-aware lint rules — see the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts).

</details>
