# ASMER AI

ASMER AI is a same-origin Cloudflare Worker application. The frontend is served from `static/index.html`, the API runs in `src/index.js`, authentication and user data are handled by Supabase, and model inference uses the Cloudflare Workers AI binding.

## Stack

- Cloudflare Workers + static assets
- Cloudflare Workers AI binding: `env.AI`
- GLM-4.7-Flash reasoning model for chat
- FLUX.1 [schnell] image generation with a per-account daily quota
- Local browser-based motion-video export from still images
- Local document/code file generation
- Supabase Auth (email confirmation, password login, password reset, optional OAuth)
- Supabase Postgres with Row Level Security for per-user conversations and messages

## Setup

1. In the Supabase SQL Editor, run the complete `schema.sql` file once.
2. In Supabase Authentication → URL Configuration, set the Site URL to your deployed Worker URL and add that same origin to the Redirect URLs allow-list.
3. In Supabase Authentication → Providers, enable email sign-up. Configure Google or GitHub only if you want those optional buttons.
4. For confirmation emails to reach addresses outside your Supabase organization, configure a verified custom SMTP sender in Supabase Auth settings. The frontend cannot fix SMTP delivery by itself.
5. The Workers AI binding and public Supabase settings are defined in `wrangler.jsonc`. No Supabase service-role key or Cloudflare API token belongs in the browser or this repository.
6. Run the updated `schema.sql` to create the secure daily image-usage quota function.
7. The default Supabase email sender only sends to organization team addresses and is limited to 2 messages per hour. Sending confirmation and reset emails to all users requires a custom SMTP provider; free provider tiers are limited and may require a verified domain.

## Local development

```sh
npm install
npm run dev
```

## Deploy

```sh
npm install
npm run deploy
```

The Worker requires the AI binding shown in `wrangler.jsonc`. Check `/api/health` after deployment; it reports whether the AI binding and Supabase configuration are present. This health check does not prove that a model inference or email delivery has succeeded.

## Database and chat history

The Worker verifies every Supabase access token with Supabase Auth before serving private API routes. It then uses that same user's JWT for PostgREST calls, so the database's Row Level Security policies remain in force. Conversations and messages are stored in Supabase and are scoped to the signed-in user.

## Creative tools and free limits

- Image generation uses `@cf/black-forest-labs/flux-1-schnell` and is capped at 3 requests per signed-in user per UTC day in the database. Cloudflare Workers AI currently includes a 10,000-neuron daily free allocation. On the Workers Free plan, requests stop when the allocation is exhausted; on a paid plan, usage beyond the free allocation can be billed.
- The Video tab creates a simple zoom/pan WebM motion clip from a still image locally in the browser. It is not text-to-video AI.
- True AI video generation is intentionally not connected in this free build. Cloudflare's FLUX 3 Video is billed per second (currently $0.15/second for HD), so calling it would not satisfy the no-cost requirement.
- File creation runs locally in the browser and supports TXT, Markdown, HTML, JSON, CSV, JavaScript, CSS and Python. Files are not uploaded.
- No service can guarantee unlimited free AI or unlimited email sending. Check each provider's current free quota and terms before launch.

## Reasoning model

The default chat model is Cloudflare's GLM-4.7-Flash, which is documented as supporting reasoning and function calling. This improves the reasoning-oriented setup but does not guarantee perfect answers or human-level intelligence.

## Legacy files

The old FastAPI/Render backend and its dependency/deployment files were removed from this Cloudflare Worker branch so there is one active backend. The active frontend is self-contained in `static/index.html`; duplicate `static/app.js` and `static/styles.css` copies were also removed. A committed local SQLite database and Python bytecode cache were removed from this branch.
