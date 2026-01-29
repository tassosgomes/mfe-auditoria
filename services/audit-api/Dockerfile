# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copia os arquivos de projeto e restaura dependências
COPY AuditApi/*.csproj AuditApi/
RUN dotnet restore AuditApi/AuditApi.csproj

# Copia o restante do código e compila
COPY AuditApi/ AuditApi/
RUN dotnet publish AuditApi/AuditApi.csproj -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "AuditApi.dll"]
