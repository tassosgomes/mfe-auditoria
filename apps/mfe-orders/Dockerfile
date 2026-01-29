# Build stage
FROM node:22-alpine AS build
WORKDIR /app

# Copia arquivos de dependência do workspace
COPY package*.json ./
COPY apps/mfe-orders/package*.json ./apps/mfe-orders/
COPY packages/libs/telemetry/package*.json ./packages/libs/telemetry/

# Instala dependências
RUN npm install --workspace=apps/mfe-orders --workspace=packages/libs/telemetry

# Copia o código fonte
COPY apps/mfe-orders/ ./apps/mfe-orders/
COPY packages/libs/telemetry/ ./packages/libs/telemetry/

# Build da telemetry e do MFE
RUN npm run build --workspace=packages/libs/telemetry
RUN npm run build --workspace=apps/mfe-orders

# Production stage com nginx
FROM nginx:alpine AS runtime
COPY --from=build /app/apps/mfe-orders/dist /usr/share/nginx/html
COPY apps/mfe-orders/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
