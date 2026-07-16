# B2 Domain Boundary Adoption

## Scope

Sprint B2 introduces additive domain boundaries for low-risk Booking, Staff, and Service read paths. It builds on the B1 runtime boundary without changing schema, migrations, bindings, secrets, deployment, booking lifecycle mutations, LINE behavior, or Web Push behavior.

## Adopted Boundaries

- Runtime Boundary: `createRuntime()` composes repositories and domain services.
- Domain Boundary: `src/domains/booking`, `src/domains/staff`, and `src/domains/service` own read validation and response mapping.
- Repository Boundary: `src/repositories/*` remains the only layer in the new path that talks to D1.

## Adopted Routes

The following read routes now pass through runtime -> domain -> repository:

- `GET /api/services`
- `GET /api/staff`
- `GET /api/merchant/bookings`

Mutation routes remain legacy-compatible and unchanged.

## Response Contract

Public response shapes are preserved:

- `/api/services` returns `{ ok, services }`
- `/api/staff` returns `{ ok, staffMembers }`
- `/api/merchant/bookings` returns `{ ok, summary, bookings, planLimited }`

Domain mappers normalize existing database rows into the same view objects consumed by the current UI.

## Tenant Boundary

Domain services require a resolved tenant context. Repositories require `tenantId` and bind it as the first SQL parameter. Cross-tenant reads are not allowed through the B2 domain services.

## Repository Rules

- Domain services do not access `env.DB`.
- Repositories own SQL.
- New repository reads include `tenant_id = ?` filters.
- No schema changes or migrations are introduced.

## Module Registry

`booking`, `staff`, and `service` are marked `partial` to reflect domain-boundary adoption. Public `/api/health` remains unchanged.

## Tests

`npm run test:domain-boundary` verifies:

- domain validation errors
- mapper output contracts
- tenant-required guard behavior
- repository SQL tenant filters
- runtime domain composition
- module registry partial status

## Out of Scope

- Booking create, cancel, reschedule, reassign, status lifecycle
- Point reversal
- Weekly hours logic
- Staff and service UI redesign
- LINE and Web Push changes
- Production deployment
