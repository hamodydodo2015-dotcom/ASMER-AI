const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_MESSAGES = 24;
const MAX_TEXT_LENGTH = 12000;

const TOOL_CATALOGUE = [
  { id: "chat", name: "AI Chat", category: "Core", description: "Ask questions and work through ideas.", permission: "standard", status: "available" },
  { id: "calculator", name: "Calculator", category: "Utilities", description: "Evaluate basic arithmetic expressions on the server.", permission: "standard", status: "available" },
  { id: "summarize", name: "Text Summarizer", category: "Productivity", description: "Create a concise summary using the AI model.", permission: "standard", status: "available" },
  { id: "data-preview", name: "Data Analyzer", category: "Analysis", description: "Calculate row counts and numeric-column statistics from JSON data.", permission: "standard", status: "available" },
  { id: "browser-research", name: "Web Research", category: "Research", description: "Search the web using a configured Tavily or Brave Search API key.", permission: "connector", status: "available" },
  { id: "github-search", name: "GitHub Search", category: "Developer", description: "Search public GitHub repositories through GitHub API.", permission: "standard", status: "available" },
  { id: "weather", name: "Weather", category: "Utilities", description: "Get current conditions and a short forecast with Open-Meteo.", permission: "standard", status: "available" },
  { id: "computer-agent", name: "Computer Agent", category: "Automation", description: "Disabled. Future local automation must be paired, allowlisted, visible, and user-approved.", permission: "explicit-approval", status: "disabled" }
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
function safeText(value, limit = MAX_TEXT_LENGTH) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}
function calculate(expression) {
  const tokens = expression.match(/\d+(?:\.\d+)?|[()+\-*/%]/g);
  if (!tokens || tokens.join("") !== expression.replace(/\s+/g, "")) throw new Error("Use numbers, parentheses, and + - * / % only.");
  let index = 0;
  function factor() {
    const token = tokens[index++];
    if (token === "+" || token === "-") { const value = factor(); return token === "-" ? -value : value; }
    if (token === "(") {
      const value = sum();
      if (tokens[index++] !== ")") throw new Error("Missing closing parenthesis.");
      return value;
    }
    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error("Invalid number.");
    return value;
  }
  function product() {
    let value = factor();
    while (["*", "/", "%"].includes(tokens[index])) {
      const op = tokens[index++], right = factor();
      if ((op === "/" || op === "%") && right === 0) throw new Error("Cannot divide by zero.");
      value = op === "*" ? value * right : op === "/" ? value / right : value % right;
    }
    return value;
  }
  function sum() {
    let value = product();
    while (tokens[index] === "+" || tokens[index] === "-") {
      const op = tokens[index++], right = product();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }
  const result = sum();
  if (index !== tokens.length || !Number.isFinite(result)) throw new Error("Invalid expression.");
  return result;
}
async function runTool(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Request body must be valid JSON." }, 400); }
  const input = safeText(body.input);
  if (!input) return json({ error: "Please provide input for the tool." }, 400);
  try {
    if (body.tool === "calculator") {
      if (input.length > 160) return json({ error: "Expression is too long." }, 400);
      return json({ tool: "calculator", result: String(calculate(input)) });
    }
    if (body.tool === "data-preview") {
      let rows;
      try { rows = JSON.parse(input); } catch { return json({ error: "Enter valid JSON: an array of objects." }, 400); }
      if (!Array.isArray(rows) || rows.length === 0 || rows.length > 500 || !rows.every(row => row && typeof row === "object" && !Array.isArray(row))) {
        return json({ error: "Provide an array containing 1–500 objects." }, 400);
      }
      const keys = [...new Set(rows.flatMap(row => Object.keys(row)))].slice(0, 30);
      const columns = {};
      for (const key of keys) {
        const values = rows.map(row => row[key]).filter(value => typeof value === "number" && Number.isFinite(value));
        if (values.length) {
          const sorted = [...values].sort((a,b) => a-b);
          columns[key] = { count: values.length, min: sorted[0], max: sorted[sorted.length-1], average: Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(4)) };
        }
      }
      return json({ tool: "data-preview", result: { rows: rows.length, columns } });
    }
    if (body.tool === "summarize") {
      if (!env.AI || typeof env.AI.run !== "function") return json({ error: "Workers AI is not enabled." }, 503);
      const result = await env.AI.run(MODEL, { messages: [
        { role: "system", content: "Summarize the user's supplied text accurately. Do not add facts not present in it. Use a concise heading and bullet points when useful." },
        { role: "user", content: input }
      ], max_tokens: 700, temperature: 0.3 });
      const summary = safeText(result?.response || result?.output_text || "");
      if (!summary) return json({ error: "The AI provider returned an empty summary." }, 502);
      return json({ tool: "summarize", result: summary });
    }
    return json({ error: "Unknown or unavailable tool." }, 404);
  } catch (error) {
    return json({ error: error.message || "Tool execution failed." }, 400);
  }
}
async function handleChat(request, env) {
  if (!env.AI || typeof env.AI.run !== "function") return json({ error: "Workers AI is not enabled. Check the AI binding and your Cloudflare account." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Request body must be valid JSON." }, 400); }
  if (!Array.isArray(body.messages) || body.messages.length === 0) return json({ error: "Send a non-empty messages array." }, 400);
  const messages = body.messages.slice(-MAX_MESSAGES).map(item => {
    const role = item?.role === "assistant" ? "assistant" : item?.role === "user" ? "user" : null;
    const content = safeText(item?.content);
    return role && content ? { role, content } : null;
  }).filter(Boolean);
  if (!messages.length || messages[messages.length-1].role !== "user") return json({ error: "The final message must be a user message." }, 400);
  try {
    const result = await env.AI.run(MODEL, { messages: [
      { role: "system", content: "You are ASMER AI, a helpful, careful assistant. Be honest about uncertainty and tool access. Never claim an action was completed unless a connected tool confirms it. Ask for confirmation before consequential external actions. Do not invent web results, files, or execution results." },
      ...messages
    ], max_tokens: 1200, temperature: 0.6 });
    const answer = safeText(result?.response || result?.output_text || "");
    return answer ? json({ reply: answer, model: MODEL }) : json({ error: "The AI provider returned an empty response." }, 502);
  } catch {
    return json({ error: "AI request failed. Check Workers AI availability and account limits." }, 502);
  }
}

async function handleResearch(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Request body must be valid JSON." }, 400); }
  const query = safeText(body.query, 300);
  if (!query) return json({ error: "Enter a research question." }, 400);
  try {
    if (env.TAVILY_API_KEY) {
      const response = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ api_key: env.TAVILY_API_KEY, query, search_depth: "basic", max_results: 5, include_answer: false }) });
      if (!response.ok) return json({ error: "Tavily search failed. Check the key and provider limits." }, 502);
      const data = await response.json();
      return json({ provider: "Tavily", results: (data.results || []).map(item => ({ title: safeText(item.title, 240), url: safeText(item.url, 1000), snippet: safeText(item.content, 1200) })) });
    }
    if (env.BRAVE_SEARCH_API_KEY) {
      const endpoint = new URL("https://api.search.brave.com/res/v1/web/search");
      endpoint.searchParams.set("q", query); endpoint.searchParams.set("count", "5");
      const response = await fetch(endpoint, { headers: { "Accept": "application/json", "X-Subscription-Token": env.BRAVE_SEARCH_API_KEY } });
      if (!response.ok) return json({ error: "Brave Search failed. Check the key and provider limits." }, 502);
      const data = await response.json();
      return json({ provider: "Brave Search", results: (data.web?.results || []).map(item => ({ title: safeText(item.title, 240), url: safeText(item.url, 1000), snippet: safeText(item.description, 1200) })) });
    }
    return json({ error: "Configure TAVILY_API_KEY or BRAVE_SEARCH_API_KEY as a Worker secret." }, 503);
  } catch { return json({ error: "Research provider could not be reached." }, 502); }
}
async function handlePlugin(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Request body must be valid JSON." }, 400); }
  const input = safeText(body.input, 200);
  if (!input) return json({ error: "Provide a search term or city." }, 400);
  try {
    if (body.plugin === "github-search") {
      const endpoint = new URL("https://api.github.com/search/repositories");
      endpoint.searchParams.set("q", input); endpoint.searchParams.set("sort", "stars"); endpoint.searchParams.set("per_page", "5");
      const response = await fetch(endpoint, { headers: { "Accept": "application/vnd.github+json", "User-Agent": "ASMER-AI" } });
      if (!response.ok) return json({ error: "GitHub search request failed." }, 502);
      const data = await response.json();
      return json({ plugin: "GitHub Search", results: (data.items || []).map(item => ({ name: safeText(item.full_name, 180), url: item.html_url, description: safeText(item.description || "No description provided.", 500), stars: item.stargazers_count, language: item.language || "Unknown" })) });
    }
    if (body.plugin === "weather") {
      const geo = new URL("https://geocoding-api.open-meteo.com/v1/search");
      geo.searchParams.set("name", input); geo.searchParams.set("count", "1"); geo.searchParams.set("language", "en"); geo.searchParams.set("format", "json");
      const geoResponse = await fetch(geo);
      if (!geoResponse.ok) return json({ error: "Weather location lookup failed." }, 502);
      const place = (await geoResponse.json()).results?.[0];
      if (!place) return json({ error: "Location not found. Try a larger nearby city." }, 404);
      const forecast = new URL("https://api.open-meteo.com/v1/forecast");
      forecast.searchParams.set("latitude", String(place.latitude)); forecast.searchParams.set("longitude", String(place.longitude));
      forecast.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m");
      forecast.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_probability_max");
      forecast.searchParams.set("forecast_days", "3"); forecast.searchParams.set("timezone", "auto");
      const weatherResponse = await fetch(forecast);
      if (!weatherResponse.ok) return json({ error: "Weather provider request failed." }, 502);
      const data = await weatherResponse.json();
      return json({ plugin: "Open-Meteo", location: [place.name, place.admin1, place.country].filter(Boolean).join(", "), current: data.current, daily: data.daily, units: data.current_units });
    }
    return json({ error: "Unknown plugin." }, 404);
  } catch { return json({ error: "Plugin provider could not be reached." }, 502); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/health") return json({ ok: true, app: "ASMER AI", version: "5.9.1", aiConfigured: Boolean(env.AI) });
    if (request.method === "GET" && url.pathname === "/api/tools") return json({ tools: TOOL_CATALOGUE });
    if (request.method === "POST" && url.pathname === "/api/research") return handleResearch(request, env);
    if (request.method === "POST" && url.pathname === "/api/plugins/run") return handlePlugin(request);
    if (request.method === "GET" && url.pathname === "/api/integrations") return json({ research: env.TAVILY_API_KEY ? "Tavily configured" : env.BRAVE_SEARCH_API_KEY ? "Brave Search configured" : "needs API key", plugins: ["GitHub Search", "Open-Meteo Weather"] });
    if (request.method === "POST" && url.pathname === "/api/tools/run") return runTool(request, env);
    if (request.method === "POST" && url.pathname === "/api/chat") return handleChat(request, env);
    if (url.pathname.startsWith("/api/")) return json({ error: "API route not found." }, 404);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("ASMER AI assets are not configured.", { status: 404 });
  }
};
