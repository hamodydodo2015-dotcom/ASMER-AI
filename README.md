# ASMER AI V5.9

A multi-language AI workspace built with HTML, CSS, JavaScript, Cloudflare Workers AI, optional Python analytics, and a small C++ utility engine.

## Current capabilities
- Responsive chat dashboard with local conversation history.
- Cloudflare Worker API with input validation and bounded chat history.
- Workers AI integration using a configurable model binding.
- Tool/plugin catalogue with permission descriptions.
- Optional FastAPI analytics service for basic dataset summaries.
- Optional C++ command-line arithmetic utility.
- No API keys in browser code.

## Architecture
```
public/                 Browser UI (HTML/CSS/JS)
worker.js               Cloudflare Worker API
wrangler.toml           Cloudflare configuration
services/python/        Optional FastAPI analytics service
engine/cpp/             Optional native utility
```

## Run the web app locally
1. Install Node.js 20+.
2. Install Wrangler: `npm install`.
3. Sign in: `npx wrangler login`.
4. Run: `npm run dev`.
5. Open the local URL printed by Wrangler.

The Worker uses the Cloudflare Workers AI binding named `AI`. Enable Workers AI for your Cloudflare account before expecting chat responses.

## Deploy
```bash
npm install
npx wrangler deploy
```

## Optional Python analytics service
```bash
cd services/python
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The Python service is separate from the deployed Worker. It is not automatically exposed to the public internet.

## Optional C++ utility
Compile with a C++17 compiler:
```bash
g++ -std=c++17 -O2 engine/cpp/utility_engine.cpp -o asmer-utility
``
Example: `./asmer-utility add 12 30` (Windows executable: `asmer-utility.exe add 12 30`).

## Security notes
- Keep provider tokens in Cloudflare Worker secrets, never in HTML or JavaScript served to browsers.
- The starter plugin catalogue is descriptive; it does not execute arbitrary code.
- Do not connect a computer-control agent to a public endpoint. Any future local agent should use pairing, a strict allowlist, visible user approval, and an emergency stop.
- The Python and C++ services are optional local components and are not remotely callable by default.
- This project is a foundation, not a claim of unrestricted autonomous access or professional legal/medical/financial advice.

## Configuration
Edit `wrangler.toml` to select a Workers AI model available to your account. The current default is `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
