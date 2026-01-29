# Build stage
FROM node:22-alpine AS build
WORKDIR /app

# Copia arquivos de dependência do workspace
COPY package*.json ./
COPY apps/mfe-users/package*.json ./apps/mfe-users/
COPY packages/libs/telemetry/package*.json ./packages/libs/telemetry/

# Instala dependências
RUN npm install --workspace=apps/mfe-users --workspace=packages/libs/telemetry

# Copia o código fonte
COPY apps/mfe-users/ ./apps/mfe-users/
COPY packages/libs/telemetry/ ./packages/libs/telemetry/

# Build da telemetry e do MFE
RUN npm run build --workspace=packages/libs/telemetry
RUN npm run build --workspace=apps/mfe-users

# Production stage com nginx
FROM nginx:alpine AS runtime
COPY --from=build /app/apps/mfe-users/dist /usr/share/nginx/html
COPY apps/mfe-users/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
