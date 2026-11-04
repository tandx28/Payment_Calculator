# Settle — Payment Calculator

A fast, private SGD payment calculator for Singapore university game nights. Enter each participant's mahjong, poker, or card-game result and Settle produces a clear payment plan.

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

In the solo calculator, optional PayNow mobile numbers stay in this browser alongside group members. In shared tables, information is sent to the session server as described below. Payment QR images are generated locally using `qrcode`; no external QR endpoint receives payment data. Existing groups containing string member names remain supported.

Each transfer uses its recipient's row index, even when names match. The QR encodes a Singapore mobile proxy, SGD currency (`702`), a fixed amount, and an EMVCo CRC-16/CCITT-FALSE checksum. The bank resolves the registered recipient name; Settle does not claim that a user-entered name is bank verified. Codes do not expire and can be reused, so check for duplicate payments.

QR encoding and decoding tests run with `npm test`. Actual bank-app acceptance, photo import, and native file sharing need device testing. The feature is labelled beta until that testing is complete; no payment is ever initiated automatically or marked confirmed.

Vercel Web Analytics is loaded through `@vercel/analytics`. Visitors can disable analytics from the Cookie Policy page. Session identifiers, invitation fragments, and query strings are redacted from analytics URLs. Solo calculator data stays in browser local storage.

## Shared tables

### Optional home-screen app

`/install` explains adding Settle from Safari (iOS/iPadOS), Chrome (Android), or a supported desktop browser. On browsers that provide `beforeinstallprompt`, a button invokes the native install prompt only after a user tap. Other browsers get manual instructions; dismissal does not block hosting or joining. The footer links to this page. An app-installed event or standalone display hides installation steps.

Webpack emits `/manifest.webmanifest` plus opaque 180/192/512 PNG icons from the lime S brand. The manifest has a stable `/` app ID, root scope, standalone display, and `/sessions` start URL. Both public domains remain usable; install from `settlelah-sg.vercel.app` for the preferred address. The app and website use the same server and normal HTTPS invite links. There is no forced installation, new account system, service worker, offline cache, push notification permission, or store submission. Shared tables still need internet and expire after 24 hours. Browser/app storage can differ, so retain the same app/browser for existing seat and host access.

Device installation UI and storage behavior need real iPhone/Android checks. Manifest/icon output, browser fallback, direct-route hosting, and the normal website flow can be checked in the local shared preview.

`/sessions` creates a 24-hour table. The host shares **Copy invite link** or **Show join QR** in the lobby. The QR encodes only the same join invitation fragment, never the host credential; it is generated locally. Participants join with their own name and optional PayNow number. Once everyone joins, the host starts the round to lock the roster. The result editor appears after the start, with a single **Save & ready** button. The server atomically saves the amount, validates the PayNow number, and marks that participant ready. A failed validation saves neither the amount nor readiness. Positive results require a PayNow number. Winnings, losses, missing results and any exact difference are displayed explicitly. Settlement unlocks only when everyone is ready and the integer-cent total is zero. All-zero rounds need no payments.

The host sees ready status and can reopen the lobby or start a fresh round after settlement. Editing a result clears that participant’s ready status. Results lock after settlement. The session screen polls every five seconds while visible, pauses when hidden, and stops when navigating away. Saved access lets each browser resume its own seat without an account. Clearing browser data loses that access; the invite does not restore host privileges.

### Free usage analytics

Enable Vercel Web Analytics in the existing project's Analytics dashboard for visitor estimates and page views. Custom Vercel events require Pro, so this app instead keeps aggregate action counts in the existing Redis database. No new service or paid upgrade is required. Counts are stored in hashes `settle:metrics:production:YYYY-MM-DD` (UTC date), expiring after 90 days. Preview and local environments use the separate `settle:metrics:preview:` prefix. View production hashes in the Upstash Data Browser or run `HGETALL settle:metrics:production:YYYY-MM-DD` in its console. These counters are never exposed by the public session API.

Fields are `tables_created`, `players_joined` (excluding retried joins), `rounds_started`, `results_submitted` (successful Save & ready actions, including corrections), and `payment_plans_unlocked`. These are action counts, not unique users or completed bank transfers. Counters are written atomically with successful session changes, exclude failed/stale requests, and contain no names, phone numbers, room IDs, results or amounts. Cookie Policy opt-out is sent with each mutation and suppresses its analytics. There is no payment-confirmation feature, so no payment-confirmed metric is collected. Opt-outs mean the counts are partial; they are not a cohort conversion funnel.

### Production storage setup (existing Vercel project)

1. Add an **Upstash for Redis** database through Vercel → Payment Calculator → Storage. Choose a free plan if available and review any terms before provisioning.
2. Connect it to this project for Production (and optionally Preview). Automatic environment variables `KV_REST_API_URL` / `KV_REST_API_TOKEN` are accepted; `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` also work.
3. Redeploy after connecting storage. `/api/sessions?action=health` must return `available: true`, then test creating and joining from two separate browsers or devices.

No credentials go in the source, browser bundle, URL, or GitHub. Production returns 503 when storage is absent; it never silently substitutes per-instance memory. Requests use server-side authenticated HTTPS POST to Redis. Atomic compare-and-set prevents concurrent writes from losing results. Expiry is fixed at creation using Redis PXAT, not extended by activity. Guest tokens and host tokens are distinct from invite access, and server storage contains only token hashes. PayNow numbers are visible only to their owner until settlement, then to table participants for payment. Names, results, and readiness are visible to all joined members. Anyone with the invite can join the open lobby, so use a private group chat.

### Local shared-session preview

```bash
npm run build
npm run preview:shared
```

Open `http://127.0.0.1:9100/sessions`. This explicit local demo uses temporary in-memory storage. It is only for development; restarting it loses demo tables. It is never imported by the production API. Use different browser profiles/devices to represent different participants (tabs share browser credentials).

`npm test` covers host/guest permissions, invite privilege boundaries, exact-zero gating, readiness changes, settlement locking, stale concurrent edits, concurrent joins, private mobile visibility, invalid requests, and expiry, as well as the QR encoder.

The included Privacy Policy, Cookie Policy, and Terms are project templates and should be reviewed by a qualified professional before commercial use.
