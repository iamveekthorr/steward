#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="$(dirname "$0")/../.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: .env not found at $ENV_FILE" >&2
    exit 1
fi

NEW_SECRET=$(openssl rand -base64 64 | tr -d '\n')

if grep -q "^JWT_SECRET=" "$ENV_FILE"; then
    sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=${NEW_SECRET}|" "$ENV_FILE"
    echo "JWT_SECRET rotated in $ENV_FILE"
else
    echo "JWT_SECRET=${NEW_SECRET}" >> "$ENV_FILE"
    echo "JWT_SECRET added to $ENV_FILE"
fi
