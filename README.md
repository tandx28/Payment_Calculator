# Settle — Payment Calculator

A fast, private group payment calculator. Enter each participant's final balance and Settle produces a minimal payment plan.

## Local development

```bash
pnpm install
pnpm dev
```

## Production

```bash
pnpm build
```

The production output is written to `docs/`. `vercel.json` configures Vercel to serve that directory and route all paths to the single-page app.

## Analytics and privacy

Vercel Web Analytics is loaded through `@vercel/analytics`. Visitors can disable analytics from the Cookie Policy page. Calculator data stays in browser local storage.

The included Privacy Policy, Cookie Policy, and Terms are project templates and should be reviewed by a qualified professional before commercial use.
