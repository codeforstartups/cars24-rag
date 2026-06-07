# Deploy Cars24 RAG App

This project has **two parts** that deploy to **two different hosts**:

| Part | Folder | Host | Why |
|------|--------|------|-----|
| **Frontend** (React) | `rag-app/frontend` | **Netlify** | Static site + CDN |
| **Backend** (FastAPI) | `rag-app/backend` | **Render** | Python API + SSE streaming |

Netlify cannot run the FastAPI server. Both must be deployed separately, then connected via an environment variable.

---

## Step 1 — Deploy backend on Render

1. Go to [render.com](https://render.com) → **New** → **Blueprint** (or **Web Service**)
2. Connect GitHub repo `codeforstartups/cars24-rag`, branch `development`
3. Render will read `render.yaml` at the repo root, or configure manually:

| Setting | Value |
|---------|-------|
| Root Directory | `rag-app/backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/health` |

4. Add **Environment Variables** in Render dashboard:

```
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=cars24-vehicles
CORS_ORIGINS=https://YOUR-SITE.netlify.app
CORS_ORIGIN_REGEX=https://.*\.netlify\.app
```

5. Deploy and copy your Render URL, e.g. `https://cars24-rag-api.onrender.com`

6. Verify: open `https://cars24-rag-api.onrender.com/health`

---

## Step 2 — Deploy frontend on Netlify

1. In Netlify → **Connect to Git** → choose **GitHub**
2. Select repo `codeforstartups/cars24-rag`, branch `development`
3. Netlify auto-reads `netlify.toml` at the repo root — **no manual path changes needed**

Confirm these settings (should be pre-filled):

| Setting | Value |
|---------|-------|
| Base directory | `rag-app/frontend` |
| Build command | `npm run build` |
| Publish directory | `rag-app/frontend/dist` |

4. Add **Environment Variable** in Netlify → Site settings → Environment variables:

```
VITE_API_URL=https://cars24-rag-api.onrender.com
```

Replace with your actual Render backend URL (no trailing slash).

5. **Deploy site** → trigger a new deploy after adding the env var.

---

## Step 3 — Verify end-to-end

1. Open your Netlify URL (e.g. `https://verdant-salmiakki-a44ae8.netlify.app`)
2. Header should show **"575 cars indexed"** and **"Connected"**
3. Search for cars — cards should load from the Render API

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Connected" shows Setup required | `VITE_API_URL` missing or wrong in Netlify — redeploy after fixing |
| CORS error in browser console | Add your Netlify URL to `CORS_ORIGINS` on Render |
| API timeout on first request | Render free tier sleeps after 15 min — first request wakes it (~30s) |
| Build fails on Netlify | Ensure base directory is `rag-app/frontend`, not repo root |

---

## Local vs production

| | Local | Production |
|--|-------|------------|
| Frontend | `npm run dev` → :5173 | Netlify CDN |
| Backend | `uvicorn main:app --port 8000` | Render |
| API URL | `/api` (Vite proxy) | `VITE_API_URL` env var |
