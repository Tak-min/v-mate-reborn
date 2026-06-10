# --- Stage 1: build the frontend (Vite outputs into backend/static) ---
FROM node:20-slim AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# --- Stage 2: build the Rust backend ---
FROM rust:1-slim AS backend-build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/src ./src
COPY backend/migrations ./migrations
COPY --from=frontend-build /app/backend/static ./static
RUN cargo build --release

# --- Stage 3: runtime image ---
FROM debian:bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*

COPY --from=backend-build /app/target/release/vmate-backend ./vmate-backend
COPY --from=backend-build /app/static ./static
COPY --from=backend-build /app/migrations ./migrations

RUN mkdir -p data/audio

ENV FRONTEND_DIR=static
ENV AUDIO_DIR=data/audio

EXPOSE 8080

CMD ["./vmate-backend"]
