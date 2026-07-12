# Sprint 2 Operations Foundation

## Scope

Sprint 2 delivers Service Management, Staff Management, Staff-Service mapping, and Booking Readiness. LINE, Promotion, QR Code, AI, Analytics, Campaign, CRM, and Notification remain out of scope.

## Service

The existing services and service_durations tables remain the source of truth. The settings surface supports:

- create by copying an existing service
- edit name, category, duration, price, resource, and point limit
- enable or disable
- sort order
- search by name or category

Enabled services are the only services returned to public booking and availability flows.

## Staff

The existing staff_members table remains the source of truth. Migration 0020 adds nullable avatar_url, phone, and email fields. The settings surface supports:

- create by copying an existing staff member
- edit name, avatar URL, phone, email, and role
- enable or disable
- Staff-Service mapping
- existing CRM capability flags

Avatar values are limited to HTTPS URLs or the existing safe image-data form. No new storage service is introduced.

## Booking Readiness

The Merchant dashboard evaluates:

- Store and Brand data
- weekly business hours
- at least one enabled Service with a valid duration and price
- at least one enabled Staff
- at least one enabled Staff-Service mapping
- plan staff selection
- onboarding and booking state

When not ready, the dashboard displays Booking Not Ready and missing actions instead of the normal booking dashboard. Public availability and booking flows continue to load only enabled Services and enabled, bookable Staff.