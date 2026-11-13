# ASMER AI

ASMER AI is a same-origin Cloudflare Worker application. The frontend is served from `static/index.html`, the API runs in `src/index.js`, authentication and user data are handled by Supabase, and model inference uses the Cloudflare Workers AI binding.

## Stack

- Cloudflare Workers + static assets
- Cloudflare Workers AI binding: `env.AI`
- Supabase Auth (email confirmation, password login, password reset, optional OAuth)
- Supabase Postgres with Row Level Security for per-user conversations and messages

## Setup

1. In the Supabase SQL Editor, run the complete `schema.sql` file once.
2. In Supabase Authentication → URL Configuration, set the Site URL to your deployed Worker URL and add that same origin to the Redirect URLs allow-list.
3. In Supabase Authentication → Providers, enable email sign-up. Configure Google or GitHub only if you want those optional buttons.
4. For confirmation emails to reach addresses outside your Supabase organization, configure a verified custom SMTP sender in Supabase Auth settings. The frontend cannot fix SMTP delivery by itself.
5. The Workers AI binding and public Supabase settings are defined in `wrangler.jsonc`. No Supabase service-role key or Cloudflare API token belongs in the browser or this repository.

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

## Usage and billing

Workers AI usage is subject to Cloudflare's current plan limits and pricing. Do not assume inference is unlimited or always free. Review the model pricing and account limits before enabling the public chat endpoint.

## Legacy files

The old FastAPI/Render backend and its dependency/deployment files were removed from this Cloudflare Worker branch so there is one active backend. The active frontend is self-contained in `static/index.html`; duplicate `static/app.js` and `static/styles.css` copies were also removed. A committed local SQLite database and Python bytecode cache were removed from this branch.
