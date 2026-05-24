# Kanzen web — multi-stage: Vite build → static nginx.
# Built + run by the root docker-compose.yml ("web" service).
#
# The SPA reaches the API at VITE_API_URL (baked at build time; defaults to
# http://localhost:8080 — i.e. the backend's host-mapped port, hit from the
# browser). CORS on the backend is allow-all, so cross-origin works. Override
# with --build-arg VITE_API_URL=… for a non-default backend address.

# --- build stage -----------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# --- serve stage: static SPA with client-side-routing fallback -------------
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3020
