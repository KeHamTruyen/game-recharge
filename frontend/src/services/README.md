# Backend integration

The UI depends on domain types from `src/domain/models.ts` and service contracts
from `src/services/contracts.ts`. Backend code should implement these contracts
instead of changing page components.

## Suggested integration order

1. Set `VITE_API_URL` to the backend base URL.
2. Instantiate `HttpClient` from `src/services/http-client.ts`.
3. Implement `AuthService`, `CatalogService`, `OrderService`, and `AdminService`.
4. Replace local mutations in `src/app/AppStore.tsx` and the route adapters with
   calls to those services.
5. Keep API DTO mapping inside `src/services`; pages should continue to consume
   the domain models.

## Suggested endpoints

```text
POST   /auth/login
POST   /auth/register
POST   /auth/forgot-password
GET    /auth/session

GET    /products
POST   /admin/products
PATCH  /admin/products/:id
DELETE /admin/products/:id

GET    /topup-templates
POST   /admin/topup-templates
PATCH  /admin/topup-templates/:id
DELETE /admin/topup-templates/:id

POST   /orders
GET    /orders/me
GET    /admin/orders
PATCH  /admin/orders/:id/status

GET    /admin/users
PATCH  /admin/users/:id
```

## Files and images

Do not send Base64 product images in product JSON in production. Upload files to
object storage first, then save the returned URL in `Product.image`.

## Authorization

The temporary email-based admin rule is UI-only. The backend must derive roles
from the authenticated session and enforce authorization on every admin route.
