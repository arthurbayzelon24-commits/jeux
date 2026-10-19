#!/usr/bin/env bash
# Vérifie que SOLVEX AI répond sur son adresse publique ; sinon, relance les conteneurs.
cd "$(dirname "$0")/.."
DOMAIN="$(grep '^DOMAIN=' .env | tail -1 | cut -d= -f2-)"
if ! curl -fsS --max-time 15 "https://$DOMAIN/api/health" >/dev/null; then
  sleep 20 # une seconde chance avant de relancer
  if ! curl -fsS --max-time 15 "https://$DOMAIN/api/health" >/dev/null; then
    echo "$(date -Is) SOLVEX AI ne répond pas : relance."
    docker compose up -d
    docker compose restart solvex caddy
  fi
fi
