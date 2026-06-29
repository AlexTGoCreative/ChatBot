# ozzy-app — React/Vite SPA, built to static assets and served by nginx.
#
# nginx also reverse-proxies the two backends so the whole app is same-origin
# (no CORS, no hard-coded host ports baked into the bundle):
#   /api/*  -> ozzy-api:5000     (auth, scans, history, engines)
#   /ask    -> ozzy-ai:7860      (RAG chat)
# Accordingly the bundle is built with VITE_API2_URL=/api.

# ---- build stage ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Same-origin paths; nginx routes them to the right service.
ARG VITE_API2_URL=/api
ARG VITE_API_URL=/ask
ENV VITE_API2_URL=$VITE_API2_URL \
    VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- serve stage ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
