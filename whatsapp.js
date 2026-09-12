import axios from "axios";

const WHATSAPP_API_VERSION = "v21.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

const BASE_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${PHONE_NUMBER_ID}`;

export async function sendWhatsAppMessage(to, text) {
  try {
    await axios.post(
      `${BASE_URL}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Failed to send WhatsApp message:", err.response?.data || err.message);
  }
}

// Marks a message as read (optional, improves UX)
export async function markAsRead(messageId) {
  try {
    await axios.post(
      `${BASE_URL}/messages`,
      {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("Failed to mark message as read:", err.response?.data || err.message);
  }
}

// Extracts the relevant fields from an incoming webhook payload.
// Returns null if the payload isn't a user text message (e.g. it's a status update).
export function parseIncomingMessage(body) {
  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return null; // e.g. delivery/read status callbacks

    const from = message.from; // customer phone number
    const messageId = message.id;
    const text =
      message.text?.body ??
      message.button?.text ??
      message.interactive?.button_reply?.title ??
      "";
    const contactName = value.contacts?.[0]?.profile?.name || "Customer";

    return { from, messageId, text, contactName };
  } catch (err) {
    console.error("Error parsing incoming WhatsApp payload:", err);
    return null;
  }
}
