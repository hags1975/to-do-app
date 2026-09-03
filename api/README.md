# API (Cloudflare Workers)

Backend for the to-do app, deployed as a Cloudflare Worker. Plain JavaScript, no framework, no bundler required beyond Wrangler's own.

## Structure

```
api/
  wrangler.toml       # Worker config (routes, bindings, vars)
  src/
    index.js          # Worker entry point (fetch handler)
    router.js          # Minimal path/method router
    routes/            # One file per resource, registers its routes
      health.js
    lib/
      responses.js      # json()/notFound()/CORS helpers
```

Add a new resource by creating `src/routes/<name>.js` exporting a
`register<Name>Routes(router)` function, then calling it from `src/index.js`.

## Local development

```
cd api
npm install
npm run dev
```

This starts `wrangler dev` on http://localhost:8787. The frontend dev server
(`npm run dev` at the repo root) runs separately on port 3000.

## Secrets and bindings

- Never commit secrets (Stripe keys, API tokens) to `wrangler.toml`. Use:
  ```
  wrangler secret put STRIPE_SECRET_KEY
  ```
- For local dev, put secrets in `api/.dev.vars` (gitignored):
  ```
  STRIPE_SECRET_KEY=sk_test_...
  ```
- Add KV/D1/R2 bindings in `wrangler.toml` as needed (see commented examples).

## Deploy

```
cd api
npm run deploy
```

Requires being logged in via `wrangler login` (or `CLOUDFLARE_API_TOKEN` set)
and a Cloudflare account with Workers enabled.
