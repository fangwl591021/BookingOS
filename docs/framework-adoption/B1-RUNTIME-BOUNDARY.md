# B1 Runtime Boundary Foundation

Status: implemented as an additive boundary layer on branch `refactor/b1-runtime-boundary-foundation`.

## Scope

This sprint introduces runtime boundaries without changing BookingOS product behavior, schema, Cloudflare bindings, LINE flows, Web Push behavior, booking lifecycle, or UI design.

Adopted runtime boundaries:

- Composition Root: `src/runtime/composition-root.js`
- Request Context: `src/runtime/request-context.js`
- Tenant Context: `src/runtime/tenant-context.js`
- Auth Context: `src/runtime/auth-context.js`
- Error Model: `src/runtime/errors.js`
- Safe Logger: `src/runtime/logger.js`
- Module Registry: `src/runtime/module-registry.js`
- Health Diagnostics: `src/runtime/diagnostics.js`
- Repository Boundary Skeleton: `src/repositories/*`

## Composition Root

`createRuntime(env, executionContext)` is the only new composition entry. It wires logger, module registry, diagnostics, request-context factory, and repository skeletons.

The existing Worker router remains authoritative. B1 does not rewrite route dispatch.

## Request And Tenant Boundary

Request context carries:

- requestId
- request
- url/path/method
- env
- tenantContext
- authContext
- request-scoped logger

Tenant context is intentionally minimal and requires explicit resolution before use. Adopted read routes call `requireTenantContext` before resolving data.

## Auth Boundary

Auth context is currently an adapter over existing merchant and customer session results. It does not replace signed cookies, LIFF login, platform login, or permission checks.

## Error Boundary

The runtime error model standardizes safe JSON error envelopes:

`{ ok: false, error: { code, message } }`

No route is broadly converted in B1. This avoids changing existing endpoint compatibility.

## Safe Logging

The logger sanitizes common sensitive keys and values before writing. It redacts tokens, secrets, cookies, authorization headers, phone numbers, email addresses, and LINE-style user IDs. B1 does not add noisy request logging.

## Module Registry

The module registry is a declarative inventory. Registered modules include:

- core-runtime
- booking
- weekly-hours
- staff
- service
- settings
- line-adapter
- web-push-adapter

This is a skeleton for later staged adoption and is surfaced through health diagnostics without exposing secrets.

## Repository Boundary Skeleton

Repository skeletons were added for booking, settings, customer, service, and staff. They enforce explicit tenant input and use tenant-scoped SQL where implemented.

B1 does not replace booking mutations or high-risk lifecycle queries.

## Adopted Routes

Low-risk adoption only:

- `GET /api/health` returns runtime diagnostics with booleans only.
- `GET /api/settings` creates a request context and validates tenant context before reading existing dashboard data.
- `GET /api/services` creates a request context and validates tenant context before existing service list loading.
- `GET /api/staff` creates a request context and validates tenant context before existing staff list loading.

Response shapes for settings, services, and staff remain unchanged.

## Safety Notes

- No migrations.
- No schema changes.
- No deployment in this task.
- No Cloudflare binding or secret changes.
- No LINE or Web Push behavior changes.
- No booking lifecycle changes.
- No cross-tenant query relaxation.

## Tests

Added `npm run test:runtime-boundary`, covering:

- tenant context
- auth context
- error model
- logger sanitization
- module registry
- repository tenant scope
- diagnostics
- request context
