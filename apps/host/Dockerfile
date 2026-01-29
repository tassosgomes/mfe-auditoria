# Build stage
FROM node:22-alpine AS build
WORKDIR /app

# Copia arquivos de dependência do workspace
COPY package*.json ./
COPY apps/host/package*.json ./apps/host/
COPY packages/libs/telemetry/package*.json ./packages/libs/telemetry/

# Instala dependências
RUN npm install --workspace=apps/host --workspace=packages/libs/telemetry

# Copia o código fonte
COPY apps/host/ ./apps/host/
COPY packages/libs/telemetry/ ./packages/libs/telemetry/

# Build da telemetry e do host
RUN npm run build --workspace=packages/libs/telemetry
RUN npm run build --workspace=apps/host

# Production stage com nginx
FROM nginx:alpine AS runtime
COPY --from=build /app/apps/host/dist /usr/share/nginx/html
COPY apps/host/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
