# -------------------------------------------------------------
# Frontend Multi-stage Build & Serve với Nginx
# -------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app/frontend

# Cài đặt dependencies
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Sao chép mã nguồn và biên dịch production
COPY frontend/ .
COPY .figma/make/site.json /app/.figma/make/site.json
ARG VITE_API_URL=/api
ARG VITE_SITE_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SITE_URL=$VITE_SITE_URL
RUN npm run build

# Stage phục vụ file tĩnh bằng Nginx
FROM nginx:alpine

COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

