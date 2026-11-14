# ASMER AI V5.9.1

A multi-language AI workspace built with HTML, CSS, JavaScript, Cloudflare Workers AI, optional Python analytics, and a small C++ utility engine.

## Working features
- Responsive chat dashboard with local conversation history.
- Cloudflare Worker AI chat endpoint with bounded message history and input validation.
- Server-side calculator supporting +, -, *, /, %, and parentheses (no eval or arbitrary code execution).
- AI-powered text summarizer through Workers AI.
- JSON data analyzer with row counts and numeric-column min, max, and average.
- Tool catalogue that distinguishes available tools from unconfigured integrations.
- Optional FastAPI analytics service and C++17 arithmetic CLI.
- Provider credentials stay on the server; no API keys in browser code.

## Architecture
```
public/                 Browser UI (HTML/CSS/JS)
worker.js               Cloudflare Worker API and tool runner
wrangler.toml           Cloudflare configuration
services/python/        Optional FastAPI analytics service
engine/cpp/             Optional native utility
```

## Run locally
1. Install Node.js 20+.
2. Run `npm install`.
3. Sign in using `npx wrangler login`.
4. Run `npm run dev` and open the local URL printed by Wrangler.
5. Enable Workers AI for the Cloudflare account to use chat and summarization.

## Deploy
```bash
npm install
npx wrangler deploy
```

## Tool examples
- Calculator: `(12 + 8) * 3`
- Summarizer: paste text into the Text Summarizer tool.
- Data Analyzer: paste JSON such as `[{"sales":10},{"sales":20}]`.

## Optional Python service
```bash
cd services/python
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
This service is separate from the deployed Worker and is not automatically exposed publicly.

## Optional C++ utility
Compile with a C++17 compiler:
```bash
g++ -std=c++17 -O2 engine/cpp/utility_engine.cpp -o asmer-utility
```

## Security boundaries
- The calculator uses a limited arithmetic parser, not eval.
- Tool requests are validated and bounded on the server.
- The tool catalogue does not execute arbitrary code.
- Web research needs a separately configured trusted search provider.
- Computer control remains disabled. Any future local agent must be paired, allowlisted, visible, and require user approval.
- Do not place provider tokens in frontend files.
