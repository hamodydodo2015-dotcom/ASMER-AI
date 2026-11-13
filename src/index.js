const DEFAULT_MODEL = "@cf/zai-org/glm-4.7-flash";
const rateBuckets = new Map();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function requireConfig(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw new HttpError(500, "Supabase is not configured in the Worker.");
  }
}

function checkOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return;
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) {
      throw new HttpError(403, "Cross-origin requests are not allowed.");
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(403, "Invalid request origin.");
  }
}

async function readJson(request) {
  const type = request.headers.get("Content-Type") || "";
  if (!type.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "Send this request as JSON.");
  }
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "The request body is not valid JSON.");
  }
}

async function requireUser(request, env) {
  requireConfig(env);
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    throw new HttpError(401, "Please sign in to continue.");
  }
  const token = authorization.slice(7).trim();
  if (!token || token.length > 5000) {
    throw new HttpError(401, "Your sign-in session is invalid.");
  }
  const response = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
    headers: {
      "apikey": env.SUPABASE_PUBLISHABLE_KEY,
      "Authorization": "Bearer " + token
    }
  });
  if (!response.ok) {
    throw new HttpError(401, "Your sign-in session expired. Please sign in again.");
  }
  const user = await response.json();
  if (!user || !user.id) throw new HttpError(401, "Could not verify your account.");
  return { user: user, token: token };
}

async function dbRequest(env, token, path, options) {
  const opts = options || {};
  const headers = Object.assign({
    "apikey": env.SUPABASE_PUBLISHABLE_KEY,
    "Authorization": "Bearer " + token,
    "Content-Type": "application/json"
  }, opts.headers || {});
  const response = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/" + path, {
    method: opts.method || "GET",
    headers: headers,
    body: opts.body
  });
  const raw = await response.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); }
    catch { data = { message: raw.slice(0, 300) }; }
  }
  if (!response.ok) {
    const message = data && (data.message || data.msg || data.error_description || data.hint);
    console.error("ASMER DATABASE ERROR:", response.status, message || "Database request failed");
    throw new HttpError(response.status >= 500 ? 502 : response.status, message || "The database request failed.");
  }
  return data;
}

function applyRateLimit(userId) {
  const now = Date.now();
  const current = rateBuckets.get(userId);
  if (!current || now - current.startedAt > 60000) {
    rateBuckets.set(userId, { startedAt: now, count: 1 });
  } else {
    current.count += 1;
    if (current.count > 8) throw new HttpError(429, "You have sent several messages. Please wait one minute.");
  }
  if (rateBuckets.size > 1500) {
    for (const entry of rateBuckets.entries()) {
      if (now - entry[1].startedAt > 120000) rateBuckets.delete(entry[0]);
    }
  }
}

function validUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getChats(env, auth) {
  const query = new URLSearchParams({
    select: "id,title,model,created_at,updated_at",
    user_id: "eq." + auth.user.id,
    order: "updated_at.desc",
    limit: "50"
  });
  const chats = await dbRequest(env, auth.token, "chats?" + query.toString());
  return json({ chats: chats || [] });
}

async function getChat(env, auth, chatId) {
  if (!validUuid(chatId)) throw new HttpError(400, "Invalid conversation ID.");
  const owner = auth.user.id;
  const chatQuery = new URLSearchParams({
    select: "id,title,model,created_at,updated_at",
    id: "eq." + chatId,
    user_id: "eq." + owner,
    limit: "1"
  });
  const chats = await dbRequest(env, auth.token, "chats?" + chatQuery.toString());
  if (!chats || !chats.length) throw new HttpError(404, "Conversation not found.");
  const messageQuery = new URLSearchParams({
    select: "id,role,content,created_at",
    chat_id: "eq." + chatId,
    user_id: "eq." + owner,
    order: "created_at.asc",
    limit: "200"
  });
  const messages = await dbRequest(env, auth.token, "messages?" + messageQuery.toString());
  return json({ chat: chats[0], messages: messages || [] });
}

async function deleteChat(env, auth, chatId) {
  if (!validUuid(chatId)) throw new HttpError(400, "Invalid conversation ID.");
  const query = new URLSearchParams({
    id: "eq." + chatId,
    user_id: "eq." + auth.user.id
  });
  await dbRequest(env, auth.token, "chats?" + query.toString(), {
    method: "DELETE",
    headers: { "Prefer": "return=minimal" }
  });
  return json({ success: true });
}

async function createChat(env, auth, message) {
  const created = await dbRequest(env, auth.token, "chats?select=id,title", {
    method: "POST",
    headers: { "Prefer": "return=representation" },
    body: JSON.stringify({
      user_id: auth.user.id,
      title: message.slice(0, 72) || "New chat",
      model: env.ASMER_MODEL || DEFAULT_MODEL
    })
  });
  if (!created || !created[0] || !created[0].id) {
    throw new HttpError(502, "Could not create the conversation.");
  }
  return created[0].id;
}

async function handleChat(request, env, auth) {
  if (!env.AI) throw new HttpError(503, "The Cloudflare Workers AI binding is missing.");
  const body = await readJson(request);
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) throw new HttpError(400, "Please enter a message.");
  if (message.length > 12000) throw new HttpError(413, "Your message is too long. Keep it under 12,000 characters.");
  applyRateLimit(auth.user.id);

  let chatId = body.chat_id || null;
  if (chatId) {
    if (!validUuid(chatId)) throw new HttpError(400, "Invalid conversation ID.");
    const check = new URLSearchParams({
      select: "id",
      id: "eq." + chatId,
      user_id: "eq." + auth.user.id,
      limit: "1"
    });
    const rows = await dbRequest(env, auth.token, "chats?" + check.toString());
    if (!rows || !rows.length) throw new HttpError(404, "Conversation not found.");
  } else {
    chatId = await createChat(env, auth, message);
  }

  const historyQuery = new URLSearchParams({
    select: "role,content",
    chat_id: "eq." + chatId,
    user_id: "eq." + auth.user.id,
    order: "created_at.desc",
    limit: "20"
  });
  const history = await dbRequest(env, auth.token, "messages?" + historyQuery.toString());

  await dbRequest(env, auth.token, "messages", {
    method: "POST",
    headers: { "Prefer": "return=minimal" },
    body: JSON.stringify({
      user_id: auth.user.id,
      chat_id: chatId,
      role: "user",
      content: message
    })
  });

  const modelMessages = [{
    role: "system",
    content: "You are ASMER AI, a highly capable reasoning assistant. Think carefully before answering, check assumptions, break complex tasks into clear steps, and verify calculations where possible. Give the user a concise explanation of the key reasoning, not hidden private chain-of-thought. Be honest about uncertainty, never invent facts or sources, and adapt explanations to the user's level. Keep answers useful, safe, and well structured."
  }];
  (history || []).reverse().forEach((item) => {
    if ((item.role === "user" || item.role === "assistant") && typeof item.content === "string") {
      modelMessages.push({ role: item.role, content: item.content.slice(0, 12000) });
    }
  });
  modelMessages.push({ role: "user", content: message });

  let result;
  try {
    result = await env.AI.run(env.ASMER_MODEL || DEFAULT_MODEL, {
      messages: modelMessages,
      max_tokens: 900,
      temperature: 0.55
    });
  } catch (error) {
    console.error("ASMER AI INFERENCE ERROR:", error);
    throw new HttpError(502, "The AI model could not answer this message. Check the Workers AI model and account limits.");
  }

  const answer = result && (result.response || (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content));
  if (typeof answer !== "string" || !answer.trim()) {
    console.error("ASMER AI EMPTY RESPONSE:", result);
    throw new HttpError(502, "The AI model returned an empty response.");
  }

  await dbRequest(env, auth.token, "messages", {
    method: "POST",
    headers: { "Prefer": "return=minimal" },
    body: JSON.stringify({
      user_id: auth.user.id,
      chat_id: chatId,
      role: "assistant",
      content: answer
    })
  });

  const updateQuery = new URLSearchParams({
    id: "eq." + chatId,
    user_id: "eq." + auth.user.id
  });
  await dbRequest(env, auth.token, "chats?" + updateQuery.toString(), {
    method: "PATCH",
    headers: { "Prefer": "return=minimal" },
    body: JSON.stringify({ updated_at: new Date().toISOString() })
  });

  return json({ response: answer, chat_id: chatId });
}


async function handleImage(request, env, auth) {
  if (!env.AI) throw new HttpError(503, "The Cloudflare Workers AI binding is missing.");
  const body = await readJson(request);
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) throw new HttpError(400, "Describe the image you want first.");
  if (prompt.length > 1800) throw new HttpError(413, "Image prompts must be 1,800 characters or fewer.");
  applyRateLimit(auth.user.id);

  const reserved = await dbRequest(env, auth.token, "rpc/reserve_ai_usage", {
    method: "POST",
    body: JSON.stringify({ p_feature: "image", p_daily_limit: 3 })
  });
  if (reserved !== true) {
    throw new HttpError(429, "You have reached the free limit of 3 image generations today. Try again after the daily reset.");
  }

  let result;
  try {
    result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt: prompt,
      steps: 4,
      width: 1024,
      height: 1024
    });
  } catch (error) {
    console.error("ASMER IMAGE ERROR:", error);
    throw new HttpError(502, "Image generation is temporarily unavailable or the free AI allowance has been reached.");
  }
  if (!result || typeof result.image !== "string" || !result.image) {
    throw new HttpError(502, "The image model returned an empty image.");
  }
  return json({ image: result.image, mime_type: "image/jpeg" });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) checkOrigin(request);
      if (url.pathname === "/api/health" && request.method === "GET") {
        return json({
          status: "online",
          application: "ASMER AI",
          aiBinding: Boolean(env.AI),
          supabaseConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY),
          model: env.ASMER_MODEL || DEFAULT_MODEL
        });
      }

      if (url.pathname.startsWith("/api/")) {
        if (url.pathname === "/api/chat" && request.method === "POST") {
          const auth = await requireUser(request, env);
          return await handleChat(request, env, auth);
        }
        if (url.pathname === "/api/image" && request.method === "POST") {
          const auth = await requireUser(request, env);
          return await handleImage(request, env, auth);
        }
        if (url.pathname === "/api/chats" && request.method === "GET") {
          const auth = await requireUser(request, env);
          return await getChats(env, auth);
        }
        const match = url.pathname.match(/^\/api\/chats\/([^/]+)$/);
        if (match && (request.method === "GET" || request.method === "DELETE")) {
          const auth = await requireUser(request, env);
          if (request.method === "GET") return await getChat(env, auth, decodeURIComponent(match[1]));
          return await deleteChat(env, auth, decodeURIComponent(match[1]));
        }
        return json({ error: "API route not found." }, 404);
      }

      if (!env.ASSETS) return json({ error: "Static asset binding is missing." }, 500);
      const assetResponse = await env.ASSETS.fetch(request);
      const headers = new Headers(assetResponse.headers);
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      headers.set("X-Frame-Options", "DENY");
      return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers: headers
      });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (!(error instanceof HttpError)) console.error("ASMER WORKER ERROR:", error);
      return json({ error: error instanceof HttpError ? error.message : "An unexpected server error occurred." }, status);
    }
  }
};
