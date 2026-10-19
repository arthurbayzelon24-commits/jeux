#!/usr/bin/env bash
# Installe SOLVEX AI sur un serveur Linux (Ubuntu / Debian) et le garde en ligne :
#   - Docker, l'application et Caddy (HTTPS automatique) ;
#   - redémarrage automatique après un plantage ou un redémarrage du serveur ;
#   - surveillance toutes les 5 minutes, avec relance si l'adresse ne répond plus.
# Usage, depuis le dossier du projet :  sudo ./deploy/install.sh [mon-domaine.fr]
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$(id -u)" -ne 0 ]; then echo "Lancez ce script avec sudo." >&2; exit 1; fi

# 1. Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "→ Installation de Docker…"
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null

# 2. Fichier .env (les clés restent sur ce serveur)
[ -f .env ] || cp .env.example .env
set_env() { # set_env NOM valeur : remplace ou ajoute la ligne NOM=valeur
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}
get_env() { grep "^$1=" .env | tail -1 | cut -d= -f2-; }

if [ -z "$(get_env SOLVEX_SESSION_SECRET)" ]; then
  set_env SOLVEX_SESSION_SECRET "$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
fi

DOMAIN="${1:-$(get_env DOMAIN)}"
if [ -z "$DOMAIN" ]; then
  # Sans nom de domaine : adresse gratuite <ip>.sslip.io, qui pointe vers l'IP de ce serveur.
  IP="$(curl -fsS4 https://api.ipify.org || true)"
  if [ -z "$IP" ]; then echo "Impossible de trouver l'IP publique : relancez avec votre domaine en argument." >&2; exit 1; fi
  DOMAIN="${IP//./-}.sslip.io"
fi
set_env DOMAIN "$DOMAIN"

# 3. Pare-feu : ports web ouverts si ufw est actif
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw allow 443/udp >/dev/null
fi

# 4. Lancement
echo "→ Construction et démarrage…"
docker compose up -d --build

# 5. Surveillance : toutes les 5 minutes, relance si l'adresse publique ne répond pas
WATCHDOG="$(pwd)/deploy/watchdog.sh"
chmod +x "$WATCHDOG"
echo "*/5 * * * * root $WATCHDOG >> /var/log/solvex-watchdog.log 2>&1" > /etc/cron.d/solvex-watchdog

echo
echo "SOLVEX AI est en ligne : https://$DOMAIN"
echo "(le premier certificat HTTPS peut prendre une minute)"
if [ -z "$(get_env OPENAI_API_KEY)" ] && [ -z "$(get_env AI_BASE_URL)" ]; then
  echo "À faire : ajoutez OPENAI_API_KEY et AI_MODEL dans .env, puis : docker compose up -d"
fi
if [ -z "$(get_env SOLVEX_ACCESS_CODE)" ]; then
  echo "Attention : sans SOLVEX_ACCESS_CODE dans .env, tout le monde peut lancer des générations avec vos clés."
fi
