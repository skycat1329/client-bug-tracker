# Multi-stage production build for Client Bug Tracker
# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci || npm install
COPY backend/ ./
RUN npm run build

# Stage 3: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_URL=file:/app/data/local.db
ENV UPLOAD_DIR=/app/uploads

# Install production dependencies only
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy compiled backend and frontend
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create persistent storage directories
RUN mkdir -p /app/data /app/uploads

EXPOSE 4000

# Mount persistent volumes for SQLite and file attachments
VOLUME ["/app/data", "/app/uploads"]

WORKDIR /app/backend
CMD ["node", "dist/server.js"]
