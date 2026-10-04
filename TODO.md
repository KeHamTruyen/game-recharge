# Production TODO

## High priority

- [ ] Add atomic multi-package checkout so one cart checkout cannot leave partially created orders.
- [ ] Add package-specific images and image positioning to the backend package model and admin editor.
- [ ] Add a proper password-change endpoint and connect the admin account form to it.
- [ ] Add server-side audit logging for admin changes and transaction status updates.
- [ ] Add automated API tests for authentication, authorization, catalog CRUD, checkout, and rate limits.

## Admin consistency

- [ ] Make STAFF explicitly read-only for catalog, templates, settings, and user management while keeping transaction processing available.
- [ ] Persist categories/tags instead of keeping the category editor only in frontend state.
- [ ] Add complete service/game editing in admin (name, description, image, tone, active state, and sort order).
- [ ] Store and validate the complete contact and middleman content shape on the backend.

## Deferred by scope

- [ ] Integrate email delivery and password-reset email flow.
- [ ] Integrate bank QR generation, payment reconciliation, and webhook verification.
