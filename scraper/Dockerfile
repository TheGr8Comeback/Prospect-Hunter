# Worker Node (scraper/). Uses the official Playwright image so Chromium and all
# its system dependencies are preinstalled — the user downloads nothing by hand.
# Pin must match the `playwright` version in package.json (1.59.1).
FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /scraper

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Env (Supabase keys) is injected by docker-compose; the worker reads process.env.
CMD ["node", "worker.js"]
