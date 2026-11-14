# ASMER AI V10 — Final Build

ASMER AI combines Cloudflare Workers AI chat, server-side tools, external research providers, public API plugins, and an optional standalone Python analytics service.

## Included
- Cloudflare Workers AI chat and summarization.
- Calculator and bounded JSON data analyzer.
- Web research through Tavily or Brave Search when configured; Wikipedia API is the no-key fallback.
- GitHub public repository search.
- City weather lookup and three-day forecast through Open-Meteo.
- Optional Python Analytics plugin connector for a separately hosted FastAPI service.
- Responsive browser dashboard with local conversation history.
- Optional C++17 arithmetic utility.
- API keys remain in Worker secrets, not browser JavaScript.

## 1. Enable Workers AI
The Worker uses an AI binding named `AI`. In Cloudflare Dashboard, open **Workers & Pages**, select `asmer-ai-v10`, go to **Settings → Bindings**, and confirm **Workers AI** is bound with variable name `AI`. The deployed script already includes this binding. See [Cloudflare Workers AI bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/).

## 2. Deploy the Worker
The V10 Worker has been deployed to the connected Cloudflare account. To deploy future GitHub changes from your computer:
```bash
git clone https://github.com/hamodydodo2015-dotcom/ASMER-AI.git
cd ASMER-AI
npm install
npx wrangler login
npm run deploy
``
Wrangler deploys the Worker and the `public/` directory. The Worker also contains a bundled UI fallback for direct API deployments. See [Cloudflare Wrangler deployment](https://developers.cloudflare.com/workers/wrangler/commands/#deploy).

## 3. Configure a broad web research provider (recommended)
Choose one:
- [Tavily API](https://tavily.com/) — create an API key.
- [Brave Search API](https://brave.com/search/api/) — create an API key.

Add the provider key as a Worker secret:
```bash
npx wrangler secret put TAVILY_API_KEY
# OR
npx wrangler secret put BRAVE_SEARCH_API_KEY
``
Then redeploy. If neither key is configured, the Research page uses the Wikipedia API as a limited no-key fallback. Tavily takes priority if both secrets are present.

## 4. Additional plugins
- **GitHub Search** calls GitHub's public repository search API.
- **Weather** uses Open-Meteo geocoding and forecast APIs; no key is required for this basic integration.
- **Python Analytics** connects to the optional FastAPI service described below.
- Calculator, summarizer, and JSON Data Analyzer run on the Worker.
The plugin catalogue describes implemented integrations; it does not execute arbitrary user code.

## 5. Run the optional Python service separately
This service runs separately from the Cloudflare Worker. For local development on Windows:
```powershell
cd services/python
py -m venv .venv
.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
$env:ASMER_API_TOKEN = "choose-a-long-random-secret"
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
``
Test it at `http://127.0.0.1:8000/health`. On macOS/Linux, use `python3 -m venv .venv` and `source .venv/bin/activate`.

A Dockerfile is provided at `services/python/Dockerfile` for hosting the service separately. When you host it, set `ASMER_API_TOKEN` in the host's environment variables and use HTTPS. Then configure the Worker secrets:
```bash
npx wrangler secret put PYTHON_ANALYTICS_URL
npx wrangler secret put PYTHON_ANALYTICS_TOKEN
``
For `PYTHON_ANALYTICS_URL`, enter the HTTPS base URL of your hosted FastAPI service (without `/analyze`). Use the exact same token value for `PYTHON_ANALYTICS_TOKEN` and the Python host's `ASMER_API_TOKEN`. Redeploy after setting secrets. Do not expose an unauthenticated analytics API publicly.

## 6. Optional C++ utility
```bash
g++ -std=c++17 -O2 engine/cpp/utility_engine.cpp -o asmer-utility
```

## Security
- Never commit API keys or put them in frontend files.
- Store provider credentials as Cloudflare Worker secrets.
- Research results are external content; open and verify original sources.
- Python analytics accepts structured JSON only and never runs uploaded code.
- Computer control is not implemented or enabled.
