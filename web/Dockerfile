# Kanzen web — multi-stage: Vite build → static nginx.
# Built + run by the root docker-compose.yml ("web" service).
#
# The SPA reaches the API at VITE_API_URL (baked at build time; defaults to
# http://localhost:28080 — i.e. the backend's host-mapped port, hit from the
# browser). CORS on the backend is allow-all, so cross-origin works. Override
# with --build-arg VITE_API_URL=… for a non-default backend address.

# --- build stage -----------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
# F01 — real Cognito sign-in is gated on these two being present at build time (cognitoEnabled in
# src/services/cognito.ts). Set them (from `terraform output cognito_user_pool_id` /
# `cognito_web_client_id`) to ship the real login; leave empty ⇒ the dev persona switcher.
ARG VITE_COGNITO_USER_POOL_ID
ARG VITE_COGNITO_CLIENT_ID
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_COGNITO_USER_POOL_ID=${VITE_COGNITO_USER_POOL_ID}
ENV VITE_COGNITO_CLIENT_ID=${VITE_COGNITO_CLIENT_ID}
RUN npm run build

# --- serve stage: static SPA with client-side-routing fallback -------------
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 23020
