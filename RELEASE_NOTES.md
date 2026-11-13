# ASMER AI 2.2.0 — Release Candidate

## What's new
- Added Twitch as a third optional social sign-in provider alongside Google and GitHub; configure its OAuth app and credentials in Twitch Developer Console and Supabase Auth.
- Pure black-and-white workspace styling.
- Google OAuth, signup confirmation, resend confirmation and password-reset flows return to the hosted ASMER website instead of `localhost`.
- Copy buttons on completed assistant answers.
- Export the visible conversation to a Markdown file.
- Version metadata updated to 2.2.0.

## Included workspace tools
- Chat using Cloudflare Workers AI GLM-4.7-Flash.
- Image generation using FLUX.1 schnell, with a three-per-user-per-day database quota.
- Local still-image motion-video export to WebM. This is not generative text-to-video.
- Local file creation for TXT, Markdown, HTML, JSON, CSV, JavaScript, CSS and Python.

## Required setup before production
1. Run the complete updated `schema.sql` in Supabase SQL Editor.
2. Set Supabase Site URL and Redirect URLs to `https://asmer-ai.hamody-dodo2015.workers.dev/`.
3. In Google Cloud OAuth credentials, add `https://sygggzdyafmzbkziehbz.supabase.co/auth/v1/callback` to Authorized redirect URIs.
4. Enable Google in Supabase Auth and enter the OAuth Client ID and Client Secret privately in the Supabase dashboard.
5. Register a Twitch OAuth application using the Supabase callback URL, then enable Twitch and save its Client ID and Client Secret privately in Supabase Auth.
6. Configure a verified custom SMTP sender privately if email confirmation and reset messages must reach arbitrary users.
7. Deploy the updated Worker and test signup, login, Google OAuth, password reset, chat, image generation, motion-video export, file downloads and Markdown export.

## Free-tier and honesty notes
- There is no guarantee of unlimited free AI inference, image generation, video generation or email delivery.
- Cloudflare Workers AI free usage is quota-limited. Keep the Cloudflare account on the Free plan if you want requests to stop at the free limit instead of incurring paid overages.
- True AI text-to-video is not included; the Video tool applies a browser-local motion effect to a still image.
- Supabase's default SMTP is restricted and rate-limited; general email delivery requires custom SMTP configuration. Free SMTP tiers have their own limits.
- No app can promise perfect answers or human-level/“1000 IQ” intelligence. Always verify important information.

## Release status
This is a **release candidate** on the development branch. It has not been merged into `main`, deployed, or live-tested against Google, Supabase or Cloudflare. Do not announce it as production-ready until the checklist above passes.
