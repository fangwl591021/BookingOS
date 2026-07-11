# BookingOS Merchant Quick Start

This guide is for the first store setup.

## 1. Open Store Backend

Login to the merchant backend and open `開店精靈`.

The wizard shows go-live progress, missing actions, public URL preview, setup test booking, and the formal booking switch.

## 2. Fill Store Profile

In the wizard, fill:

- store name
- phone
- address
- business type
- timezone
- logo later from settings, if available

The store slug is display-only. Merchants cannot change it.

## 3. Set Business Hours

Set open time, close time, break time, and closed days.

## 4. Apply a Template or Create Services

Templates can create starter services, durations, and resource suggestions for therapy, massage, hair, nail, and beauty.

Templates do not create staff, customers, bookings, points, or LINE settings.

## 5. Create Resources

Create the physical capacity unit:

- bed
- chair
- room
- table

Set quantity to the number of customers that can be served at the same time for that resource.

If services do not need a resource, they can remain unassigned.

## 6. Create Staff

Create staff members only after at least one service exists.

Select which services each staff member can perform. The wizard does not allow staff-service bindings to point at another tenant's services.

## 7. Preview Public URL

Use `複製公開網址` or `預覽客戶端` from the wizard.

Do not send the booking URL to customers until the checklist is complete and booking is opened.

## 8. Run Test Booking

Click `建立測試預約`.

The test booking does not create real customer points and does not notify customers. It records setup completion through `setup_test_completed_at`.

## 9. Open Formal Booking

Click `開放正式預約` after the wizard shows the setup is ready.

After this, customers can book from the public store URL.
## 10. Daily Booking Operations

After formal booking is open, use `預約營運` in the merchant backend.

The workspace shows today's bookings, status counts, expected revenue, completed revenue, filters by date/status/staff/service/customer keyword, and cards for each booking.

Merchants can confirm bookings, mark arrival, start service, complete service, mark no-show, cancel, reschedule, reassign staff, save internal notes, and view event history. Internal merchant notes are not shown to customers.
