# Dockerfile

# ---------- build stage ----------
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy rest of the source
COPY . .

# Build the production bundle
RUN npm run build

# ---------- serve with nginx ----------
FROM nginx:alpine

# Copy build output to nginx default html dir
COPY --from=build /app/build /usr/share/nginx/html

# Optional: custom nginx config (uncomment COPY below if you create it)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
