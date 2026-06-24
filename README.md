# Presentation Builder

Collaborative AI-powered presentation builder with live Looker data ingestion via webhook.

## Architecture

```
pres-builder/
  src/           ← React frontend (Vite)
  server/        ← Express webhook server
  public/        ← Static assets incl. Spark Studio template
```

```
Looker ──POST──▶ :3001/webhook/:dept ──▶ server/data/<dept>/latest.json
                                                    │
React app ◀──GET /reports──────────────────────────┘
     │
     └──▶ Claude AI agent ──▶ generated deck ──▶ .pptx (Spark Studio template)
```

## Quick start

### 1. Install dependencies

```bash
# Frontend
npm install

# Webhook server
cd server && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
cp server/.env.example server/.env
```

Edit both `.env` files:
- `.env` → set `VITE_ANTHROPIC_API_KEY` and `VITE_SERVER_URL=http://localhost:3001`
- `server/.env` → set `WEBHOOK_SECRET`, optionally `ADMIN_USER` / `ADMIN_PASS`

### 3. Run both servers

**Terminal 1 — webhook server:**
```bash
cd server && npm run dev
```

**Terminal 2 — React frontend:**
```bash
npm run dev
```

Open http://localhost:5173

---

## Webhook setup in Looker

Set the delivery URL to:
```
http://your-server:3001/webhook/<dept>
```

Set the `Authorization` header to `Bearer <WEBHOOK_SECRET>`.

Looker can deliver JSON or CSV — both are handled automatically.

### Department ids

| Department | Webhook URL |
|---|---|
| Marketing | `/webhook/marketing` |
| Social Media Marketing | `/webhook/social-media` |
| Digital | `/webhook/digital` |
| Creative | `/webhook/creative` |
| Client Services | `/webhook/client-services` |

### Routing strategies

Edit `server/dept-map.js` to switch between:

| Strategy | How dept is identified |
|---|---|
| `URL_PARAM` *(default)* | `POST /webhook/marketing` |
| `PAYLOAD_FIELD` | `{ "department": "Marketing", ... }` in body |
| `TOKEN_MAP` | Each dept gets its own Authorization token |

---

## Admin API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/reports` | List all depts + metadata |
| `GET` | `/reports/:dept` | Latest payload for a dept |
| `GET` | `/reports/:dept/history` | Delivery history |
| `DELETE` | `/reports/:dept` | Clear a dept's data |
| `GET` | `/health` | Server health check |

**Test with curl:**
```bash
# Send a test report
curl -X POST http://localhost:3001/webhook/marketing \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-here" \
  -d '{"rows":[{"Metric":"Revenue","Value":"$1.2M"},{"Metric":"Leads","Value":"342"}],"headers":["Metric","Value"],"rowCount":2}'

# Read it back
curl http://localhost:3001/reports/marketing
```

---

## Customising departments

Edit `src/lib/constants.js` — the `id` field is what goes in webhook URLs.

## Production build

```bash
npm run build    # React app → dist/
```

Deploy `server/` to any Node.js host. Update the CORS origin in `server/index.js` to your production domain.
