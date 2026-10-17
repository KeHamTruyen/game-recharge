# syntax=docker/dockerfile:1
# Frontend build and static serving using Docker Hardened Images.

FROM dhi.io/node:22-alpine3.24-dev AS build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts && npm rebuild esbuild

COPY frontend/ .
COPY .figma/make/site.json /app/.figma/make/site.json
ARG VITE_API_URL=/api
ARG VITE_SITE_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SITE_URL=$VITE_SITE_URL
RUN npm run build

FROM dhi.io/nginx:1.30.5-alpine3.24

COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
