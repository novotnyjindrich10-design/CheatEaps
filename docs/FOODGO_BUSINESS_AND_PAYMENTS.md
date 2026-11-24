# FoodGo — Business & Payments

Datum: 2026-11-24  
Větev: `foodgo-launch-preview`  
Stav: **Comgate dle oficiálního protokolu; ostrý outbound vypnutý**

## Protokol (ověřeno proti apidoc.comgate.cz)

1. **Create** `POST https://payments.comgate.cz/v1.0/create` — `merchant` + `secret` v těle, `prepareOnly=true`, cena v haléřích, `curr=CZK`, `test=true|false`.
2. **Push** na `/api/payments/webhook` — form/JSON s `merchant`, `secret`, `transId`, `refId`, `status`, `price`, `curr`, `test`.
3. **Status verify** `POST /v1.0/status` — povinné; aktivace jen podle ověřeného stavu.
4. **Return URL** neaktivuje.
5. **test=true** se neaktivuje při `PAYMENTS_LIVE` / `VERCEL_ENV=production`.
6. Vlastní HMAC `x-cheapeats-signature` / `PAYMENT_WEBHOOK_SECRET` **není** Comgate mechanismus a už se pro push nepoužívá.

## Env

```
PAYMENT_PROVIDER=comgate
PAYMENT_MERCHANT_ID=...
PAYMENT_SECRET=...          # create + push + status (+ DB app.payment_webhook_secret)
PAYMENTS_SANDBOX_OUTBOUND=true
PAYMENTS_LIVE=false
VERCEL_AUTOMATION_BYPASS_SECRET=...   # webhook URL query bypass
```

Webhook URL za Vercel Authentication:  
`https://<host>/api/payments/webhook?x-vercel-protection-bypass=<SECRET>`

Detail: kořenový `FOODGO-LAUNCH.md`.
