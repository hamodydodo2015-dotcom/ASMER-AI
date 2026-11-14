const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_MESSAGES = 24;
const MAX_TEXT_LENGTH = 12000;

const TOOL_CATALOGUE = [
  { id: "chat", name: "AI Chat", category: "Core", description: "Ask questions and work through ideas.", permission: "standard", status: "available" },
  { id: "summarize", name: "Text Summarizer", category: "Productivity", description: "Summarize text supplied in the conversation.", permission: "standard", status: "available" },
  { id: "data-preview", name: "Data Preview", category: "Analysis", description: "Prepare and explain small datasets supplied by the user.", permission: "standard", status: "planned" },
  { id: "browser-research", name: "Web Research", category: "Research", description: "Requires a separately configured, trusted search integration.", permission: "connector", status: "not-configured" },
  { id: "computer-agent", name: "Computer Agent", category: "Automation", description: "Not enabled in this starter. Future local automation must be paired, allowlisted, visible, and user-approved.", permission: "explicit-approval", status: "disabled" }
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function safeText(value) {
  return typeof value === "string" ? value.trim().slice(0, MAX_TEXT_LENGTH) : "";
}

async function handleChat(request, env) {
  if (!env.AI || typeof env.AI.run !== "function") {
    return json({ error: "Workers AI is not enabled. Check the AI binding in wrangler.toml and your Cloudflare account." }, 503);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: "Request body must be valid JSON." }, 400); }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: "Send a non-empty messages array." }, 400);
  }

  const messages = body.messages.slice(-MAX_MESSAGES).map((item) => {
    const role = item?.role === "assistant" ? "assistant" : item?.role === "user" ? "user" : null;
    const content = safeText(item?.content);
    return role && content ? { role, content } : null;
  }).filter(Boolean);

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return json({ error: "The final message must be a user message." }, 400);
  }

  const system = {
    role: "system",
    content: "You are ASMER AI, a helpful, careful assistant. Be honest about uncertainty and tool access. Never claim an action was completed unless a connected tool confirms it. Ask for confirmation before consequential external actions. Do not invent web results, files, or execution results."
  };

  try {
    const result = await env.AI.run(MODEL, {
      messages: [system, ...messages],
      max_tokens: 1200,
      temperature: 0.6
    });
    const answer = safeText(result?.response || result?.output_text || "");
    if (!answer) return json({ error: "The AI provider returned an empty response." }, 502);
    return json({ reply: answer, model: MODEL });
  } catch (error) {
    return json({ error: "AI request failed. Check Workers AI availability and account limits." }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true, app: "ASMER AI", version: "5.9.0", aiConfigured: Boolean(env.AI) });
    }
    if (request.method === "GET" && url.pathname === "/api/tools") {
      return json({ tools: TOOL_CATALOGUE });
    }
    if (request.method === "POST" && url.pathname === "/api/chat") {
      return handleChat(request, env);
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "API route not found." }, 404);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("ASMER AI assets are not configured.", { status: 404 });
  }
};
