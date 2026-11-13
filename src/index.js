
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({ status: "online", app: "ASMER AI" });
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const body = await request.json();
        const message = String(body.message || "").trim();

        if (!message) {
          return Response.json({ error: "Please enter a message." }, { status: 400 });
        }

        const result = await env.AI.run(
          "@cf/meta/llama-3.1-8b-instruct",
          {
            messages: [
              {
                role: "system",
                content: "You are ASMER AI, a helpful, friendly and intelligent AI assistant."
              },
              { role: "user", content: message }
            ]
          }
        );

        return Response.json({
          response: result.response || "I couldn't generate a response."
        });
      } catch (error) {
        return Response.json({
          error: "AI request failed. Check your Cloudflare Workers AI configuration."
        }, { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
