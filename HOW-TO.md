# HookVault Free — How To

A complete walkthrough: register a source, add an endpoint, send an event, and
inspect delivery.

Assume HookVault is running at `http://127.0.0.1:3000`.

## 1. Create a source

A *source* is an authenticated producer of events.

```bash
curl -X POST http://127.0.0.1:3000/sources \
  -H "content-type: application/json" \
  -d '{"name":"Orders Service"}'
```

Response (the `ingest_key` is shown **once** — store it securely):

```json
{
  "id": "src_ab12...",
  "name": "Orders Service",
  "ingest_key": "src_ab12....<secret>"
}
```

## 2. Add a delivery endpoint

```bash
curl -X POST http://127.0.0.1:3000/sources/src_ab12.../endpoints \
  -H "content-type: application/json" \
  -d '{"url":"https://your-customer.example.com/webhooks"}'
```

## 3. Send an event

Authenticate with the ingest key as a Bearer token:

```bash
curl -X POST http://127.0.0.1:3000/ingest \
  -H "content-type: application/json" \
  -H "authorization: Bearer src_ab12....<secret>" \
  -d '{"event_type":"order.created","payload":{"id":42,"total":19.99}}'
```

Response is immediate (`202 Accepted`) — delivery happens in the background:

```json
{ "event_id": "evt_...", "status": "accepted" }
```

## 4. What your customer receives

HookVault POSTs to the endpoint with a signed envelope:

```
POST /webhooks
x-hookvault-timestamp: 1750000000
x-hookvault-signature: v1=<hex hmac>
content-type: application/json

{ "id": "evt_...", "type": "order.created", "data": {"id":42,"total":19.99}, "created_at": "..." }
```

### Verifying the signature (customer side)

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

function verify(signingSecret, timestamp, rawBody, header) {
  const expected = createHmac('sha256', signingSecret)
    .update(`${timestamp}.`).update(rawBody).digest('hex');
  const got = header.replace(/^v1=/, '');
  const a = Buffer.from(expected), b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

The signing secret is derived from your `MASTER_SIGNING_SECRET`. (Retrieving and
rotating per-endpoint secrets via API is a Premium feature.)

## 5. Inspect deliveries

```bash
# Everything about one event, including every attempt
curl http://127.0.0.1:3000/events/evt_...

# Recent attempts across all events
curl "http://127.0.0.1:3000/deliveries?limit=50"
```

…or open the dashboard at `http://127.0.0.1:3000/`.

## Retry behavior

Failed deliveries retry on a fixed interval up to `MAX_DELIVERY_ATTEMPTS`. After
the final failed attempt the event is marked **dead**. Viewing a dead-letter
queue and replaying dead events are Premium features.
