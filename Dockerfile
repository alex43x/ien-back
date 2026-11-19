# ─── Backend — Node.js 20 Alpine ─────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# Instala dependencias primero (capa cacheada)
COPY package*.json ./
RUN npm ci --only=production

# Copia el código fuente
COPY src/ ./src/
COPY scripts/auditoria-consultar.js scripts/auditoria-db.js ./scripts/

EXPOSE 3000

CMD ["node", "src/server.js"]
