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

For the P1 security update, back up the database and encryption keys, then stop
API writers before running the migrations. Keep the same `DATA_ENCRYPTION_KEY`
(at least 32 characters in production); retain old keys in
`PREVIOUS_ENCRYPTION_KEYS` when rotating keys.

```powershell
npm run db:generate --prefix backend
npm run build:all
npm run db:deploy
npm run db:migrate-passwords --prefix backend
npm run start:backend
```

Migration `20261011160000_topup_field_snapshot` must run before the updated API.
It adds historical field classifications for new orders. For old orders without
that metadata, the data migration encrypts all nonempty string fields; customer
responses mask unknown fields (including old UIDs). Admin order details still
decrypt these values while fulfillment is pending or processing. The migration
also masks legacy checkout caches and can be rerun safely. Do not roll back to
API code that assumes these legacy values are plaintext.

With Docker Compose, build the new images, stop the old backend, and run
`docker compose run --rm migrate` before starting the updated stack. The migrate
service runs both schema and data migrations; never start the API if it fails.
SePay webhook requests must contain a positive safe-integer JSON number `id`
and numeric `transferAmount`; missing IDs are rejected, even with a reference code.

Set `NODE_ENV=production`, use HTTPS, set `CORS_ORIGIN` to the exact frontend
origin(s), and never commit `.env` files. Email delivery and bank QR/payment reconciliation are intentionally outside this
setup. The storefront catalog, authentication, orders, templates, users, and
admin transaction controls are connected to the API and PostgreSQL database.
Admin package/template/status changes require an authenticated ADMIN account;
staff accounts are limited to operational admin access.

## Remaining work

### Backend container security checks

Rebuild with `docker build --pull -t duke-backend:security-review ./backend`, then
scan the resulting image with
`docker scout cves duke-backend:security-review --only-severity critical,high`.
The production image excludes npm/npx/Yarn; Compose calls the installed Prisma
CLI directly with `node node_modules/prisma/build/index.js migrate deploy`.
An IDE warning on `FROM node:22-alpine` describes the upstream base image, which
can differ from the final image after OS updates and package-manager removal.
Rebuild and rescan for new advisories; cached build layers do not fetch new OS patches.
Use `--no-cache --pull` when forcing a fresh OS package update. On 2026-10-11,
Docker Scout reported 0 Critical / 0 High for the locally built linux/amd64 image
(`ef70e05747ba`), versus 0 Critical / 12 High for the upstream base examined.
Prisma CLI, bcrypt, Sharp, API health, and Compose configuration checks passed.
This filtered scan does not claim zero vulnerabilities of every severity.

See [TODO.md](./TODO.md) for the tracked production backlog. The highest
priority items are atomic multi-package checkout, complete package/service
media editing, a real password-change flow, admin audit logging, and automated
API coverage.
