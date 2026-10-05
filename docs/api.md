# REST API & webhooks

## Submit feedback

`POST /api/v1/feedback` is public and CORS-enabled. Authenticate with the project
key in the body (`key`) or the `X-Hootbox-Key` header. The key is **not a
secret**: it can only create feedback.

```bash
curl -X POST https://YOUR-HOOTBOX/api/v1/feedback \
  -H "content-type: application/json" \
  -d '{
    "key": "pk_…",
    "type": "bug",
    "message": "The export button does nothing",
    "title": "Export broken",
    "rating": 2,
    "email": "jane@acme.com",
    "name": "Jane",
    "pageUrl": "https://myapp.com/reports",
    "metadata": { "plan": "pro", "seats": 12 }
  }'
```

| Field      | Type                                                       | Notes |
| ---------- | ---------------------------------------------------------- | ----- |
| `message`  | string, 2–5000 chars                                       | **Required** |
| `type`     | `idea` \| `bug` \| `praise` \| `question` \| `other`        | Default `idea` |
| `title`    | string ≤ 140                                               | |
| `rating`   | integer 1–5                                                | Mood: 😖 → 😍 |
| `email`    | email                                                      | Required if the project is set to require it (widget only) |
| `name`     | string ≤ 80                                                | |
| `pageUrl`  | string ≤ 2048                                              | |
| `metadata` | object, ≤ 20 keys; values string/number/boolean/null       | |

**Responses**

- `201 { "ok": true, "id": "…", "number": 42, "message": "<thank-you text>" }`
- `400 { "error": "…", "code": "BAD_REQUEST" }`: validation failed
- `403 { …, "code": "FORBIDDEN" }`: origin not allowed
- `404 { …, "code": "NOT_FOUND" }`: unknown key
- `429 { …, "code": "RATE_LIMITED" }`: 10 submissions / 10 min per IP per project

Bodies are limited to 32 KB.

## Other endpoints

| Endpoint                                | Auth         | Description |
| --------------------------------------- | ------------ | ----------- |
| `GET /api/v1/widget-config?key=pk_…`    | public       | Widget appearance settings |
| `GET /api/projects/:projectId/export`   | session      | CSV export of all feedback |
| `GET /api/health`                       | public       | `{ ok: true }` when the DB is reachable |

## Webhooks

Set a webhook URL per project in **Settings → Notifications**. It fires on every
new piece of feedback.

- `https://hooks.slack.com/…` → formatted Slack message
- `https://discord.com/api/webhooks/…` → formatted Discord message (mentions disabled)
- anything else → JSON:

```json
{
  "event": "feedback.created",
  "project": { "id": "…", "name": "Pixel Planner", "slug": "pixel-planner" },
  "feedback": {
    "id": "…", "number": 42, "type": "bug", "status": "new", "source": "widget",
    "title": null, "message": "…", "rating": 2,
    "authorName": "Jane", "authorEmail": "jane@acme.com",
    "pageUrl": "…", "metadata": {}, "createdAt": "2026-10-05T12:00:00.000Z"
  },
  "url": "https://YOUR-HOOTBOX/app/p/…?id=…"
}
```

### Verifying signatures

Every request carries:

```
X-Hootbox-Event: feedback.created
X-Hootbox-Timestamp: 1791196840
X-Hootbox-Signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>" with your signing secret>
```

```js
import { createHmac, timingSafeEqual } from "node:crypto";

function verify(rawBody, headers, secret) {
  const ts = headers["x-hootbox-timestamp"];
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // replay window
  const expected = "sha256=" + createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  const given = headers["x-hootbox-signature"] ?? "";
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
```

Delivery is best-effort with a 5 s timeout and no retries; a failing webhook
never loses feedback. Webhooks to private/internal addresses are blocked unless
`ALLOW_PRIVATE_WEBHOOKS=true`.
