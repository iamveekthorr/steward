# Build context: repo root (required for workspace Cargo.lock)
# ── Build stage ───────────────────────────────────────────────────────────────
FROM rust:1.87-slim-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Workspace manifests + lock — separate layer so dep compilation is cached
# when only source files change
COPY Cargo.toml Cargo.lock ./
COPY apps/api/Cargo.toml ./apps/api/Cargo.toml
COPY apps/api/migrations ./apps/api/migrations
COPY apps/api/src ./apps/api/src

RUN cargo build --release -p steward

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libssl3 libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/steward ./steward
COPY --from=builder /app/apps/api/migrations ./migrations

EXPOSE 3000

CMD ["./steward"]
