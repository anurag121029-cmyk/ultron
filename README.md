# ULTRON — Master Blaster

ULTRON Master Blaster is a **fresh, standalone** personal voice AI assistant — a
ChatGPT-like helper with a 3D character, built from scratch at
`~/workspace/ultron-master`. It is a **separate project from EDITH AI** and from
the earlier ULTRON v1 at `~/workspace/ultron` (kept intact as a backup); nothing
is shared between them.

## What it does

- **3D ULTRON avatar** (`components/UltronAvatar.tsx`, Three.js): metallic head,
  glowing eyes, brows, mouth and torso. It idles (breathing, blinking, head
  sway), leans in while listening, looks up while thinking, and moves its mouth
  while speaking. Expressions: happy, neutral, sad, surprised, thinking,
  listening, speaking — driven by reply sentiment, camera emotion, and a manual
  picker. Mouth movement is **rhythmic animation, not phoneme-accurate lip sync**.
- **Voice**: browser Web Speech recognition with interim results and a hands-free
  loop — tap *Start talking*, speak, ULTRON replies out loud via text-to-speech,
  then listens again until you tap *Stop*. Typing is a fallback. ULTRON never
  records in the background; only transcripts you send reach the server.
- **Phone camera emotion**: only after you tap *Start camera*. MediaPipe
  FaceLandmarker blendshapes, loaded on demand from CDN and run locally in the
  browser. The label shown is a **rough estimate — not a medical or psychological
  assessment**. No video frames are uploaded or stored; *Stop camera* releases
  all camera tracks. If emotion reading is unavailable, the app says so honestly
  instead of fabricating a label.
- **Chat** (`POST /api/chat`): server-side Gemini, key kept server-side only.
  Default model `gemini-3.8-flash` — **not** `gemini-2.0-flash`, which Google shut
  down on 1 Jun 2026. Friendly system prompt: warm, helpful daily assistant,
  short spoken replies (1–3 sentences unless detail is asked). Without a key it
  returns an honest 503; a 404 says the model may be retired.
- **Image generation** (`POST /api/image`): Gemini image model
  (`GEMINI_IMAGE_MODEL`, default `gemini-2.5-flash-image`) with responseModalities
  `["TEXT","IMAGE"]`, returns base64 image + mime type. UI prompt box, Generate,
  result display and download. Never fakes an image: no key → 503, provider
  failure → 502, no image data → 422.
- **Vision** (`POST /api/vision`): upload a photo + question, ULTRON describes or
  answers about it using the chat model. Max ~5 MB, PNG/JPEG/WebP/GIF. The image
  is sent to Gemini for that one request only and is not stored.
- **Daily Work, local-only** (localStorage, labelled on-device — no server, no
  auth, no Supabase, nothing syncs): to-do tasks (add/check/delete), reminders
  with a time (a list for today — no push notifications yet), quick notes
  (add/delete), and **saved memories** — save any ULTRON reply as a memory; the
  few relevant to your next question are injected into chat context (keyword
  match, capped at 3, max 20 memories).
- **Chat history**: rename the chat (title input), copy any ULTRON reply, save a
  reply as a memory, clear the chat.

## No Supabase / auth

Deliberately standalone: no database, no accounts, no login. Conversations live
in the page session; daily work lives in the browser's localStorage.

## Run it

```bash
cd ultron-master
npm install
cp .env.example .env.local   # fill in GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

Production build: `npm run build && npm start`.

## Phone app (installable PWA)

ULTRON is an installable phone app — no app store needed. It is a Progressive
Web App: `public/manifest.webmanifest` (name ULTRON, standalone display),
real generated icons (`icon-192.png`, `icon-512.png`, maskable 512, 180px
Apple touch icon, favicon), and a service worker (`public/sw.js`) that caches
only the app shell so the installed app opens offline. The icon PNGs are not
committed — they are generated from `public/icon.svg` by
`scripts/generate-icons.mjs`, which runs on `postinstall`, so every fresh
install (including Vercel's build) regenerates them before the app is built. The service worker
never caches `/api/*` — chat, image and vision always go to the network — and
never caches user data. It is registered only in production builds, so
`npm run dev` is never served a stale cached shell.

**Install on Android (Chrome):** open the live site → tap **📲 Install ULTRON
app** when it appears, or Chrome menu → *Add to Home Screen* / *Install app*.
**Install on iPhone (Safari):** open the live site in Safari → tap **Share**
(the square with an arrow) → **Add to Home Screen** → **Add**. iPhones have
no automatic install prompt, so the app shows those steps instead. Once
installed, ULTRON opens full-screen from your home screen like a real app.

Install needs a **live HTTPS link** — a phone will not install or grant
mic/camera over plain HTTP. And chat, image generation and vision need a
Gemini key (`GEMINI_API_KEY` in `.env.local` / on the host); without it they
honestly report "not configured". Offline, the installed shell still opens,
but chat, images and vision need internet.

## Try it on a phone

Camera and microphone need **HTTPS** (or localhost). On a phone, serve the app
over HTTPS (e.g. a tunnel / deployed host) — plain HTTP on a remote device will
block camera/mic permission. Chrome / Edge work best for speech recognition and
camera. Safari support for speech recognition is limited.

## Configuration

`.env.example`:

- `GEMINI_API_KEY` — from Google AI Studio (required for chat, image and vision).
- `GEMINI_MODEL` — default `gemini-3.8-flash`.
- `GEMINI_IMAGE_MODEL` — default `gemini-2.5-flash-image`.

No `.env` file is committed; never paste keys in chat.

## Tests

```bash
npm test        # unit tests: reply-expression mapping, blendshape and
                # face-geometry emotion heuristics, daily-work helpers
                # (tasks, notes, reminders, memories), chat/image/vision
                # route validation, and PWA checks (manifest, icons,
                # service worker, layout wiring)
npm run typecheck
npm run build
```

## Limitations

- Emotion reading is a rough, on-device estimate, not a diagnosis or a reliable
  read of anyone's psychological state. It depends on lighting, camera angle and
  browser support, and may be unavailable on some devices.
- Speech recognition quality and language support depend on the browser/OS
  speech service.
- Lip movement is rhythmic animation, not true phoneme lip sync.
- Reminders are a visible list only — no alarms or push notifications yet.
- Saved memories use simple keyword matching, not embeddings.
- Without a Gemini key, chat / image / vision replies are unavailable (honest
  error shown). The image model `gemini-2.5-flash-image` is deprecated with a
  15 Mar 2027 shutdown date, but is still served at the time of writing.
