# ASMER AI

**Current release candidate: 2.2.0** — monochrome workspace, hosted OAuth redirects, copyable AI answers and Markdown conversation export.

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
3. In Supabase Authentication → Providers, enable email sign-up. Configure Google, GitHub or Twitch only if you want those optional buttons.
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

 
## Twitch OAuth setup

ASMER AI supports Twitch sign-in through Supabase Auth. The Twitch button uses the same hosted OAuth return URL as the other social providers.

1. In the [Twitch Developer Console](https://dev.twitch.tv/console/apps), register an application. Choose the appropriate website category and set the OAuth Redirect URL to this exact Supabase callback:

   ```text
   https://sygggzdyafmzbkziehbz.supabase.co/auth/v1/callback
   ```

2. Copy the Twitch Client ID and generate/copy its Client Secret.
3. In **Supabase → Authentication → Providers → Twitch**, enable Twitch and enter the Client ID and Client Secret privately in the dashboard.
4. Confirm that Supabase **Authentication → URL Configuration** allows the hosted ASMER URL:

   ```text
   https://asmer-ai.hamody-dodo2015.workers.dev/
   ```

5. Save the provider settings and test the Twitch button on the deployed ASMER site.

Keep the Twitch Client Secret in Supabase provider settings only. Never put it in frontend code, wrangler.jsonc, or GitHub. Twitch login cannot work until the provider is enabled and configured in Supabase.

## Google OAuth setup (important)

The app sends OAuth, signup-confirmation and password-reset return links to the production site URL below, not the current browser origin (which could be `localhost`):

```text
https://asmer-ai.hamody-dodo2015.workers.dev/
```

Configure both sides of the OAuth redirect:

1. In **Supabase → Authentication → URL Configuration**, set **Site URL** to the production URL above and add the exact same URL to **Redirect URLs**.
2. In **Supabase → Authentication → Providers → Google**, enable Google and save the Google OAuth Client ID and Client Secret privately in the dashboard.
3. In **Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Web Client**, add this exact URI under **Authorized redirect URIs**:

   ```text
   https://sygggzdyafmzbkziehbz.supabase.co/auth/v1/callback
   ```

4. Add the deployed ASMER URL under **Authorized JavaScript origins** if requested:

   ```text
   https://asmer-ai.hamody-dodo2015.workers.dev
   ```

5. Save changes and test Google sign-in from the deployed site. Google checks the **Supabase callback URI** against Authorized redirect URIs; it is not the same as the ASMER website URL. A `redirect_uri_mismatch` error means that callback URI is missing or differs by even one character.

Never put the Google Client Secret in frontend code or commit it to GitHub. The app code cannot edit Google Cloud or Supabase dashboard settings automatically.


## Version 2.2.0 release notes

- Fixed Google OAuth, signup confirmation, resend-confirmation and password-reset redirect targets to use the hosted ASMER website rather than the browser's current origin.
- Added a one-click copy action to assistant answers.
- Added Markdown export for the currently displayed conversation.
- Added a visible application version label and updated package metadata to 2.2.0.
- Preserved the black-and-white interface and the existing chat, image, motion-video and file tools.

### Release checklist

- Apply the current `schema.sql` in Supabase.
- Configure Supabase Site URL and Redirect URLs.
- Add the Supabase callback URL to Google Cloud's Authorized redirect URIs and configure the Google provider in Supabase.
- Configure custom SMTP privately if confirmation/reset email delivery to all users is required.
- Keep Cloudflare Workers on the Free plan to avoid paid AI overage charges; image/video quotas remain provider-limited.
- Deploy and run live tests before announcing this as a production release.
