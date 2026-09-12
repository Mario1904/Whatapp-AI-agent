import Anthropic from "@anthropic-ai/sdk";
import { searchProducts, getProductDetails, checkStock } from "./products.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-6";
const MAX_TOOL_ITERATIONS = 6;

const SYSTEM_PROMPT = `You are a helpful, friendly customer support agent for an online store, chatting with customers over WhatsApp.

Guidelines:
- Keep replies short and conversational — this is WhatsApp, not email. 2-4 sentences is usually enough.
- Use the tools available to look up real product info, prices, and stock. Never invent product details, prices, or stock levels.
- If a customer asks about something outside product questions (e.g. billing disputes, complaints, refunds, order tracking), use the escalate_to_human tool instead of guessing.
- If a product is out of stock, say so honestly and suggest an alternative if one exists.
- Do not use markdown formatting (no asterisks, no headers) since WhatsApp renders it differently. Plain text only, emoji are fine sparingly.
- If you don't have enough information to answer, ask a brief clarifying question rather than guessing.`;

const tools = [
  {
    name: "search_products",
    description:
      "Search the product catalog by keyword (name, category, or description). Returns a list of matching products with basic info.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term, e.g. 'running shoes' or 'backpack'" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_product_details",
    description: "Get full details for a specific product by SKU, including description, colors, sizes, and price.",
    input_schema: {
      type: "object",
      properties: {
        sku: { type: "string", description: "The product SKU, e.g. 'SHOE-001'" },
      },
      required: ["sku"],
    },
  },
  {
    name: "check_stock",
    description: "Check current stock level for a specific product by SKU.",
    input_schema: {
      type: "object",
      properties: {
        sku: { type: "string", description: "The product SKU, e.g. 'SHOE-001'" },
      },
      required: ["sku"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Flag this conversation for a human agent to take over. Use for complaints, refund/billing requests, or anything you cannot resolve with product info.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Brief reason for escalation" },
      },
      required: ["reason"],
    },
  },
];

function executeTool(name, input) {
  switch (name) {
    case "search_products":
      return searchProducts(input.query);
    case "get_product_details":
      return getProductDetails(input.sku);
    case "check_stock":
      return checkStock(input.sku);
    case "escalate_to_human":
      // In production: notify a human agent (Slack webhook, ticket system, etc.)
      console.log(`[ESCALATION] Reason: ${input.reason}`);
      return { status: "escalated", note: "A human team member has been notified and will follow up shortly." };
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// conversationHistory: array of { role: "user" | "assistant", content: string }
export async function runAgent(conversationHistory) {
  const messages = [...conversationHistory];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      // Model produced a final text reply
      const textBlock = response.content.find((b) => b.type === "text");
      return textBlock?.text?.trim() || "Sorry, I didn't quite catch that — could you rephrase?";
    }

    // Model wants to call one or more tools
    messages.push({ role: "assistant", content: response.content });

    const toolResults = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const result = executeTool(block.name, block.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  return "Sorry, I'm having trouble processing that right now — let me get a team member to help you.";
}
