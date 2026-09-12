# WhatsApp AI Customer Agent

An AI agent that answers customer product questions over WhatsApp, powered by Claude. Built to receive messages from WhatsApp ads ("Click to WhatsApp" campaigns) and reply automatically using a product catalog.

## How it works

```
Customer messages your WhatsApp number
   → Meta sends it to /webhook (this server)
   → Claude reads the conversation + decides whether to search products,
     get product details, check stock, or escalate to a human
   → Reply is sent back to the customer via the WhatsApp Cloud API
```

## 1. Prerequisites

- Node.js 18+
- An Anthropic API key: https://console.anthropic.com
- A Meta Developer account + WhatsApp Business app: https://developers.facebook.com
- A public URL for your webhook (use `ngrok` for local testing, or deploy to a host like Render/Railway/Fly.io)

## 2. Set up WhatsApp Cloud API

1. Go to [Meta for Developers](https://developers.facebook.com) → create an app → add the **WhatsApp** product.
2. Under **WhatsApp > API Setup** you'll get:
   - A temporary access token (or generate a permanent one via a System User for production)
   - A **Phone Number ID** (Meta gives you a free test number to start)
3. Note both values — you'll put them in `.env`.

## 3. Install & configure

```bash
npm install
cp .env.example .env
# then fill in .env with your real values
```

## 4. Run locally with a tunnel

```bash
npm start
# in a separate terminal:
npx ngrok http 3000
```

Copy the `https://xxxx.ngrok.io` URL ngrok gives you.

## 5. Register your webhook with Meta

In your Meta App → WhatsApp → Configuration:
- **Callback URL**: `https://xxxx.ngrok.io/webhook`
- **Verify Token**: same string you set as `WHATSAPP_VERIFY_TOKEN` in `.env`
- Subscribe to the `messages` field

Meta will hit your `/webhook` GET endpoint to verify — the server handles this automatically.

## 6. Test it

Send a WhatsApp message to your test number (e.g. "Do you have running shoes?") and watch your server logs. The agent will search `data/products.json`, and reply.

## 7. Connect it to your ads

Once this works, create a **Click to WhatsApp** ad in Meta Ads Manager, set the destination to this same WhatsApp number, and optionally pre-fill an opening message. Customers who tap the ad land straight in this chat flow.

## Files

| File | Purpose |
|---|---|
| `src/server.js` | Express app, webhook verification & message receiving |
| `src/agent.js` | Claude agent loop, system prompt, tool definitions |
| `src/products.js` | Product catalog lookup functions (the agent's "tools") |
| `src/whatsapp.js` | Sending messages & parsing incoming webhook payloads |
| `data/products.json` | Sample product catalog — replace with your real data or a DB |

## Next steps for production

- **Replace `data/products.json`** with a real database (Postgres, MongoDB, or your existing e-commerce backend's API).
- **Replace the in-memory `conversations` Map** in `server.js` with Redis or a database — right now conversation history is lost on server restart and won't work across multiple server instances.
- **Add human escalation delivery** — the `escalate_to_human` tool currently just logs to console. Wire it to Slack, email, or your helpdesk (e.g. via a webhook or ticketing API).
- **Add authentication/signature verification** on the webhook (Meta signs requests with `X-Hub-Signature-256`) to make sure requests are genuinely from Meta.
- **Handle images/catalog messages** — WhatsApp supports sending product catalog cards, not just text; useful once you have a Meta Commerce Catalog connected.
- **Rate limiting** to prevent abuse.
- **Monitoring/logging** — track escalations, failed sends, and response times.
