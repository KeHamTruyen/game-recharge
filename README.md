# Game Recharge

## Project structure

- `frontend/` - React/Vite storefront and admin UI
- `backend/` - Express/Prisma API
- `.figma/` - Figma Make project configuration

## Local setup

Requirements: Node.js 20+ and PostgreSQL 14+.

```powershell
npm install --prefix frontend
npm install --prefix backend
Copy-Item backend\.env.example backend\.env
```

Edit `backend/.env` with a real PostgreSQL connection string, unique `JWT_SECRET`
(at least 64 characters in production), `COOKIE_SECRET`, and seed-only
`ADMIN_EMAIL`/`ADMIN_PASSWORD`.

For a new local database:

```powershell
npm run db:migrate
npm run db:seed
```

Start the applications in separate terminals:

```powershell
npm run dev:frontend
npm run dev:backend
```

The frontend is available at `http://localhost:5173` and the API at
`http://localhost:3000`.

## Production checks and deployment

```powershell
npm run build:all
npm run db:deploy
npm run start:backend
```

Set `NODE_ENV=production`, use HTTPS, set `CORS_ORIGIN` to the exact frontend
origin(s), and never commit `.env` files. Email delivery, bank QR/payment
reconciliation, and connecting the storefront state to the API are intentionally
outside this setup.
