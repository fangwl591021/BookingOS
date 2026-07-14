# Web Push Notifications

BookingOS 的瀏覽器通知是獨立於 LINE OA 的通知通道。店家或會員在已登入的 HTTPS 頁面手動授權後，訂閱會綁定目前 Session 的 tenant 與身份。

## Runtime

- Worker endpoint: `/api/push/public-key`, `/api/push/status`, `/api/push/subscribe`, `/api/push/unsubscribe`
- Service Worker: `/push-sw.js`
- Subscription storage: KV binding `PUSH_KV`
- Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`; optional `VAPID_SUBJECT`
- No D1 migration is required.
- No LINE UID, LINE token, or LINE OA setting is required.

## Enablement

1. Create a KV namespace and bind it as `PUSH_KV` in the Worker configuration.
2. Store VAPID keys as Worker secrets. Never commit them or expose the private key.
3. Deploy with `nodejs_compat` enabled for the `web-push` package.
4. Sign in to a tenant settings page over HTTPS and click `啟用瀏覽器通知`.
5. The browser must support Service Worker, Push API, Notification, and secure context. iOS/iPadOS requires the site to be added to the Home Screen before web push can be enabled.

## Event Delivery

Booking events `created`, `confirmed`, `rescheduled`, and `cancelled` invoke the independent Web Push sender when configured. Existing LINE notification code remains a separate legacy path and is not used by the Web Push subscription API.

Expired subscriptions returning HTTP 404 or 410 are removed from KV. Subscription keys are hashed and do not contain the raw browser endpoint.