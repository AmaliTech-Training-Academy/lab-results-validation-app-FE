# Stage 1: Build (compiles the SPA from source)
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 (CI): runtime built from a PRE-BUILT dist/ (no rebuild).
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime-prebuilt
# Patch base-image OS packages so Trivy doesn't fail on fixed CVEs in the
# alpine base (openssl, libpng, libxml2, etc.). Needs root; drop back after.
USER root
RUN apk --no-cache upgrade
USER nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist /usr/share/nginx/html
EXPOSE 8080

# Stage 3 (default): runtime built from source (local dev / docker-compose).
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
USER root
RUN apk --no-cache upgrade
USER nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
