# -------------------------------------------------------------
# Backend Multi-stage Build cho Node.js API
# -------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Cài đặt công cụ build cần thiết cho bcrypt
RUN apk add --no-cache python3 make g++ openssl

# Cài đặt dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Sao chép Prisma schema và mã nguồn
COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage chạy Production siêu nhẹ (LTS hardened)
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Cài đặt thư viện chạy cần thiết và nhận các bản vá Alpine mới nhất
RUN apk update \
    && apk upgrade --no-cache \
    && apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist

# Tạo thư mục uploads và chuẩn bị ảnh mẫu ban đầu
RUN mkdir -p uploads seed_uploads
COPY uploads ./seed_uploads/

EXPOSE 3000

# Chạy migrate DB, chuyển đổi dữ liệu nhạy cảm cũ, sao chép ảnh mẫu vào uploads volume nếu chưa có, và khởi động ứng dụng
CMD ["sh", "-c", "(cp -n /app/seed_uploads/* /app/uploads/ 2>/dev/null || true) && exec node dist/index.js"]
