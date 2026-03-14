# Check My Cream

MVP application for cosmetic ingredient review.

The app lets a user upload a product label image, runs OCR when needed, normalizes the ingredient list, sends the normalized input to an AI analysis service, and returns a structured result for the frontend.

## Stack

- Next.js
- TypeScript (`strict`)
- App Router
- Zod

## Deployment choice for MVP

### Short comparison

- Vercel
  - Best fit for the current project because it is already a Next.js app with App Router and route handlers.
  - Simplest env management and fastest path to deployment for an MVP.
  - Good default for hosting both frontend and server-side API routes in one place.

- Railway
  - Flexible and good for full-stack deployments, but slightly more setup than Vercel for a Next.js-first MVP.
  - Better fit if you later want more custom infra control.

- Render
  - Also workable, but usually a bit slower and less frictionless for a small Next.js MVP.

### Recommended option

Use **Vercel** for the backend and web app deployment.

Then point the Android app to that deployed backend through:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend.example.com
```

## Important safety rules

- API keys must stay on the server only.
- The frontend must never call external OCR or AI providers directly.
- The app does not provide medical diagnoses.
- The app must not invent ingredient concentrations.
- If OCR confidence is low, the result confidence is lowered and warnings are shown.

## Environment variables

Copy `.env.example` to `.env.local` for local development.

### Variables

- `AI_PROVIDER`
  - `remote` to use a real external AI API
  - `mock` to use the local mock provider

- `NEXT_PUBLIC_API_BASE_URL`
  - Public base URL for frontend requests to your deployed backend
  - If empty, the frontend uses local relative routes like `/api/...`
  - Use this for Android/mobile builds so the app can call an external backend
  - Safe to expose because it is only a backend URL, not a secret

- `CORS_ALLOWED_ORIGINS`
  - Comma-separated list of allowed cross-origin frontend origins
  - Needed when Android/mobile or another frontend origin calls the deployed backend
  - Example:
    - `https://your-web-app.vercel.app,capacitor://localhost,http://localhost`

- `AI_API_URL`
  - Base URL or endpoint for the external AI analysis API
  - Required when `AI_PROVIDER=remote`

- `AI_API_KEY`
  - Secret API key for the external AI analysis API
  - Required when `AI_PROVIDER=remote`
  - Server only

- `OCR_PROVIDER`
  - `remote` to use a real external OCR or vision API

- `OCR_API_URL`
  - Base URL or endpoint for the external OCR API
  - Required when `OCR_PROVIDER=remote`

- `OCR_API_KEY`
  - Secret API key for the external OCR API
  - Required when `OCR_PROVIDER=remote`
  - Server only

## Local run

### 1. Install dependencies

```bash
npm install
```

### 2. Create local env file

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

### 3. Configure providers

Set real OCR configuration:

- `AI_PROVIDER=remote`
- `AI_API_URL`
- `AI_API_KEY`
- `OCR_PROVIDER=remote`
- `OCR_API_URL`
- `OCR_API_KEY`

If you want to test AI without a real AI provider, you can still use:

```env
AI_PROVIDER=mock
OCR_PROVIDER=remote
```

### 4. Start the app

```bash
npm run dev
```

Then open:

- [http://localhost:3000](http://localhost:3000)

For local web development, leave `NEXT_PUBLIC_API_BASE_URL` empty so the frontend continues using the current local Next.js API routes.

## Useful scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```

## Web and Android backend mode

The frontend now supports two modes:

- Web dev mode:
  - `NEXT_PUBLIC_API_BASE_URL` is empty
  - requests go to local relative routes such as `/api/analyze-ingredients`

- Android/mobile mode:
  - `NEXT_PUBLIC_API_BASE_URL` points to your deployed backend origin
  - requests go to `https://your-backend.example.com/api/...`

The request and response contracts stay the same in both modes.

## How to run

### Web locally

1. Keep `NEXT_PUBLIC_API_BASE_URL` empty in `.env.local`
2. Run:

```bash
npm run dev
```

3. Open:

- [http://localhost:3000](http://localhost:3000)

### Android with external backend

1. Set this in the env used for the Android web build:

```env
NEXT_PUBLIC_API_BASE_URL=__PASTE_BACKEND_URL_HERE__
```

2. Build and sync the Android wrapper:

```bash
npm run android:sync
```

3. Open Android Studio:

```bash
npm run android:open
```

4. Run on device or emulator from Android Studio

## How to deploy

### Recommended: Vercel

1. Push the repository to GitHub, GitLab, or Bitbucket.
2. Import the project into Vercel.
3. Add the production environment variables from `.env.example`.
4. Keep all AI and OCR secrets only in server-side env vars.
5. Deploy.

Recommended production env setup:

```env
NEXT_PUBLIC_API_BASE_URL=
CORS_ALLOWED_ORIGINS=https://your-web-app.vercel.app,capacitor://localhost,http://localhost
AI_PROVIDER=remote
AI_API_URL=https://openrouter.ai/api/v1/chat/completions
AI_API_KEY=__PASTE_KEY_HERE__
AI_MODEL=openai/gpt-4o-mini
OCR_PROVIDER=remote
OCR_API_URL=https://api.ocr.space/parse/image
OCR_API_KEY=__PASTE_KEY_HERE__
```

Notes:

- For the deployed web app hosted on the same Vercel domain, `NEXT_PUBLIC_API_BASE_URL` can stay empty.
- For the Android app, use the deployed backend origin in `NEXT_PUBLIC_API_BASE_URL` when building the mobile web bundle.
- If the Android app calls the deployed backend directly, make sure `CORS_ALLOWED_ORIGINS` includes the origins you want to allow.

## Where the mobile backend URL is set

The backend URL for mobile is set in:

- [`.env.example`](C:\Users\Джерманчик\WebstormProjects\CheckMyCream\.env.example)
- your real local env file, for example `.env.local`, through:

```env
NEXT_PUBLIC_API_BASE_URL=__PASTE_BACKEND_URL_HERE__
```

This value is read by:

- [`api-client.ts`](C:\Users\Джерманчик\WebstormProjects\CheckMyCream\src\lib\api-client.ts)

## Deployment notes for Vercel

### Recommended setup

- Deploy as a standard Next.js app.
- Add all environment variables in the Vercel project settings.
- Keep OCR and AI secrets in Vercel server environment variables only.
- Do not expose `AI_API_KEY` or `OCR_API_KEY` through public env vars.

### Suggested production config

- Use `AI_PROVIDER=remote`
- Use `OCR_PROVIDER=remote`
- Set `AI_API_URL`, `AI_API_KEY`, `OCR_API_URL`, `OCR_API_KEY`

### Before deploying

1. Make sure mock providers are disabled in production.
   OCR must use a real provider. There is no filename-based OCR fallback.
2. Confirm the external OCR and AI endpoints are reachable from Vercel.
3. Check timeout behavior for your chosen providers.
4. Run `npm run lint` and `npm run typecheck`.
5. Run `npm run build`.

## Production readiness checklist

- Env
  - Set `AI_PROVIDER=remote`
  - Set `OCR_PROVIDER=remote`
  - Set `AI_API_URL`, `AI_API_KEY`, `AI_MODEL`
  - Set `OCR_API_URL`, `OCR_API_KEY`
  - Set `CORS_ALLOWED_ORIGINS` for mobile and any separate frontend origins
  - Set `NEXT_PUBLIC_API_BASE_URL` only for mobile/external frontend builds

- Secrets
  - Never expose `AI_API_KEY` or `OCR_API_KEY` in public env vars
  - Keep provider keys only on the server
  - Do not move OCR or AI calls to the client

- CORS / origin considerations
  - Web on the same deployed origin does not need cross-origin setup
  - Android/mobile using an external backend URL does need allowed origins
  - The API routes now support `OPTIONS` and origin-based CORS headers through `CORS_ALLOWED_ORIGINS`

- Error handling
  - API routes return normalized error JSON
  - Frontend already maps server errors to user-friendly states
  - Invalid upstream JSON still falls back to safe handling in the AI layer

- Timeouts
  - OCR and AI upstream calls already use timeout-aware fetch logic
  - Re-check provider timeout values before production traffic

- Logging
  - Temporary server-side logs currently exist in the analysis pipeline and AI provider
  - Keep them for staging/debugging, but reduce noisy logs before wider production rollout

## Architecture summary

- `src/app/api/*` contains thin route handlers.
- `src/features/ingredient-analysis/services/*` contains orchestration and business logic.
- `src/features/ingredient-analysis/adapters/*` contains provider integration layers.
- `src/features/ingredient-analysis/domain.ts` contains shared domain types and Zod schemas.

## Server-only reminder

External AI and OCR calls, API keys, and provider secrets must remain on the server only.
