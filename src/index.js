
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({
        status: "online",
        aiBinding: Boolean(env.AI),
        application: "ASMER AI"
      });
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        if (!env.AI) {
          throw new Error("Workers AI binding AI is missing.");
        }

        const body = await request.json();
        const message = String(body.message || "").trim();

        if (!message) {
          return Response.json(
            { error: "Please enter a message." },
            { status: 400 }
          );
        }

        const result = await env.AI.run(
          "@cf/google/gemma-4-26b-a4b-it",
          {
            messages: [
              {
                role: "system",
                content: "You are ASMER AI, a helpful and intelligent assistant."
              },
              {
                role: "user",
                content: message
              }
            ]
          }
        );

        const answer =
          result.response ||
          result.choices?.[0]?.message?.content;

        if (!answer) {
          throw new Error("The AI model returned an empty response.");
        }

        return Response.json({ response: answer });

      } catch (error) {
        console.error("ASMER AI ERROR:", error);

        return Response.json({
          error: error.message || "Unknown AI error"
        }, { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
