# Game Recharge

Production-oriented game top-up storefront for customers and an authenticated
admin console for catalog, content, users, and transaction operations.

## Project structure

- `frontend/` - React/Vite storefront and admin UI
- `backend/` - Express/Prisma API
- `.figma/` - Figma Make project configuration

## Current capabilities

- React 19/Vite storefront with responsive desktop and mobile layouts.
- Game, service package, template, status, settings, user, and transaction
  data loaded from the backend API with local fallback data for development.
- Cookie-based authentication with `ADMIN`, `STAFF`, and `CUSTOMER` roles.
- Multi-package in-memory cart with quantity controls and checkout submission.
- Admin console with responsive mobile sidebar, package/template/status
  management, content settings, user status management, and transaction
  processing.
- PostgreSQL persistence through Prisma, request validation with Zod, bcrypt
  password hashing, Helmet, CORS, rate limiting, and input size limits.

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

### Local test accounts

The local development database can use:

```text
Admin:    admin@test.com / 123456
Customer: customer@test.com / 123456
```

Change these credentials before sharing a deployed environment.

## Production checks and deployment

```powershell
npm run build:all
npm run db:deploy
npm run start:backend
```

Set `NODE_ENV=production`, use HTTPS, set `CORS_ORIGIN` to the exact frontend
origin(s), and never commit `.env` files. Email delivery and bank QR/payment reconciliation are intentionally outside this
setup. The storefront catalog, authentication, orders, templates, users, and
admin transaction controls are connected to the API and PostgreSQL database.
Admin package/template/status changes require an authenticated ADMIN account;
staff accounts are limited to operational admin access.

## Remaining work

See [TODO.md](./TODO.md) for the tracked production backlog. The highest
priority items are atomic multi-package checkout, complete package/service
media editing, a real password-change flow, admin audit logging, and automated
API coverage.
