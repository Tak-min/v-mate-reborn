# V-Mate Reborn

An AI companion app: chat with a 3D VRM character that responds with voice,
emotion-driven expressions, and lip-sync.

## Stack

- **Backend**: Rust (Axum, Tokio, SQLx + PostgreSQL)
- **Frontend**: React + TypeScript (Vite, React Three Fiber, `@pixiv/three-vrm`)
- **AI**: Gemini (streaming chat), ElevenLabs (TTS), AssemblyAI (STT)
- **Auth**: JWT access/refresh tokens, argon2 password hashing, Google OAuth

## Project Layout

```
backend/    Rust API server (Axum) — also serves the built frontend
frontend/   React + Vite client (React Three Fiber VRM viewer)
```

## Local Development

### Prerequisites

- Rust (stable, 1.82+)
- Node.js 20+
- PostgreSQL 16 (or use the `postgres` service in `docker-compose.yml`)

### 1. Start PostgreSQL

```bash
docker compose up -d postgres
```

### 2. Configure environment

```bash
cp .env.example .env
# fill in API keys (Gemini, ElevenLabs, AssemblyAI, Google OAuth, JWT secret)
```

### 3. Run the backend

```bash
cd backend
cargo run
```

Migrations in `backend/migrations/` run automatically on startup.

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api`, `/ws`, and `/audio` to `http://localhost:8080`.
Open http://localhost:5173.

## Production Build

```bash
docker compose up -d --build
```

This builds the frontend (output copied into `backend/static`), compiles the
Rust backend, and runs both the app and PostgreSQL via `docker-compose.yml`.
The app is served at http://localhost:8080.

## Testing

```bash
# Backend
cd backend && cargo test

# Frontend
cd frontend && npx tsc --noEmit
```
