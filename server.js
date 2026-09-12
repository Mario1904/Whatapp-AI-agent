import "dotenv/config";
import express from "express";
import { sendWhatsAppMessage, markAsRead, parseIncomingMessage } from "./whatsapp.js";
import { runAgent } from "./agent.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// In-memory conversation store: { [phoneNumber]: [{role, content}, ...] }
// Replace with Redis/a database for production so history survives restarts
// and scales across multiple server instances.
const conversations = new Map();

const MAX_HISTORY_MESSAGES = 20; // trim to keep token usage sane

function getHistory(phone) {
  return conversations.get(phone) || [];
}

function saveHistory(phone, history) {
  const trimmed = history.slice(-MAX_HISTORY_MESSAGES);
  conversations.set(phone, trimmed);
}

// --- Webhook verification (Meta calls this once when you set up the webhook) ---
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// --- Incoming messages ---
app.post("/webhook", async (req, res) => {
  // Respond immediately so Meta doesn't retry/timeout; process async.
  res.sendStatus(200);

  const parsed = parseIncomingMessage(req.body);
  if (!parsed || !parsed.text) return; // ignore status callbacks, non-text events, etc.

  const { from, messageId, text, contactName } = parsed;
  console.log(`Incoming from ${contactName} (${from}): ${text}`);

  markAsRead(messageId);

  const history = getHistory(from);
  history.push({ role: "user", content: text });

  try {
    const reply = await runAgent(history);
    history.push({ role: "assistant", content: reply });
    saveHistory(from, history);

    await sendWhatsAppMessage(from, reply);
    console.log(`Replied to ${from}: ${reply}`);
  } catch (err) {
    console.error("Agent error:", err);
    await sendWhatsAppMessage(
      from,
      "Sorry, something went wrong on our end. A team member will follow up with you shortly."
    );
  }
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`WhatsApp AI agent server running on port ${PORT}`);
});
