
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Test that the Worker is running
    if (url.pathname === "/api/health") {
      return Response.json({
        status: "online",
        application: "ASMER AI",
        message: "ASMER AI Worker is running!"
      });
    }

    // Serve the actual ASMER AI website
    return env.ASSETS.fetch(request);
  }
};
