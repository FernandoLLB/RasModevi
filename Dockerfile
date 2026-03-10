# Stage 1: Build frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
ARG VITE_STORE_API_URL=""
ARG VITE_DEVICE_API_URL="https://pi.modevi.es"
ENV VITE_STORE_API_URL=$VITE_STORE_API_URL
ENV VITE_DEVICE_API_URL=$VITE_DEVICE_API_URL
RUN npm run build

# Stage 2: Backend + frontend dist
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY --from=frontend-builder /app/frontend/dist frontend/dist
EXPOSE 8000
CMD cd backend && uvicorn main_store:app --host 0.0.0.0 --port ${PORT:-8000}
