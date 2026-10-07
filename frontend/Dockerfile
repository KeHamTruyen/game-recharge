# -------------------------------------------------------------
# Frontend Multi-stage Build & Serve với Nginx
# -------------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

# Cài đặt dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Sao chép mã nguồn và biên dịch production
COPY . .
RUN npm run build

# Stage phục vụ file tĩnh bằng Nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

