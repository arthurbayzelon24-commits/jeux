# SOLVEX AI — image du serveur (Node.js, aucune dépendance npm).
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY server ./server
COPY public ./public
COPY scripts ./scripts
# Horodate le service worker, puis donne le dossier à l'utilisateur non privilégié « node ».
RUN node scripts/build.js && mkdir -p /app/data && chown -R node:node /app
USER node
ENV HOST=0.0.0.0 PORT=3000 SOLVEX_DATA_DIR=/app/data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "server/index.js"]
