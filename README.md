# ASMER AI V10 — Final Build

ASMER AI combines Cloudflare Workers AI chat, server-side tools, optional FastAPI analytics, and external provider integrations.

## Included
- Cloudflare Workers AI chat and summarization.
- Calculator and bounded JSON data analyzer.
- Live web research using Tavily or Brave Search (configure one API key).
- GitHub public repository search.
- City weather lookup and three-day forecast through Open-Meteo.
- Responsive browser dashboard with local conversation history.
- Optional standalone Python FastAPI analytics service and C++17 utility.
- API keys stay in Worker secrets, not browser JavaScript.

## 1. Enable Workers AI
The Worker is configured with an AI binding named `AI` in `wrangler.toml`. In Cloudflare Dashboard, open **Workers & Pages**, select your Worker, go to **Settings → Bindings**, add **Workers AI** with variable name `AI` if it is not already present, then redeploy. See [Cloudflare Workers AI bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/).

## 2. Deploy the Worker
On a computer with Node.js 20+:
```bash
git clone https://github.com/hamodydodo2015-dotcom/ASMER-AI.git
cd ASMER-AI
npm install
npx wrangler login
npm run deploy
```
Wrangler uploads the Worker and the `public/` assets. It prints the deployed URL. See [Cloudflare Wrangler deployment](https://developers.cloudflare.com/workers/wrangler/commands/#deploy).

## 3. Configure real web research
Choose one provider:
- [Tavily API](https://tavily.com/) — create an API key.
- [Brave Search API](https://brave.com/search/api/) — create an API key.

Store the key as a Worker secret; never paste it into HTML or browser JavaScript:
```bash
npx wrangler secret put TAVILY_API_KEY
# OR
npx wrangler secret put BRAVE_SEARCH_API_KEY
``
Then redeploy. The Research page calls `POST /api/research`. If both secrets are configured, Tavily is selected first.

## 4. Additional plugins
- GitHub Search uses GitHub's public repository search API.
- Weather uses Open-Meteo geocoding and forecast APIs; no API key is required for this basic integration.
- Calculator, summarizer, and JSON Data Analyzer run through the Worker API.
The catalogue describes the integrations actually implemented. It does not execute arbitrary user code.

## 5. Run the optional Python service separately
This FastAPI service is a separate process; Cloudflare Workers do not start it:
```bash
cd services/python
python -m venv .venv
# Windows PowerShell:
.venv\\Scripts\\Activate.ps1
# Windows cmd:
.venv\\Scripts\\activate.bat
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
``
Test it at `http://127.0.0.1:8000/health`. Keep it bound to localhost for local use. If you later host it, add authentication, HTTPS, rate limits, and strict CORS before exposing it publicly.

## 6. Optional C++ utility
```bash
g++ -std=c++17 -O2 engine/cpp/utility_engine.cpp -o asmer-utility
```

## Security
- Never commit API keys or place them in frontend files.
- Use Worker secrets for provider credentials.
- Research results are external content; verify original sources.
- Computer control is not implemented or enabled.
- The Python service is separate and should not be exposed publicly without authentication and HTTPS.
