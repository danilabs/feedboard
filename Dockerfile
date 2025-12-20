# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage - serve static files with Caddy
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY Caddyfile.docker /etc/caddy/Caddyfile
EXPOSE 80 443
