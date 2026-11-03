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

Optional PayNow mobile numbers are stored only in this browser alongside group members. Payment QR images are generated locally using `qrcode`; no external QR endpoint receives payment data. Existing groups containing string member names remain supported.

Each transfer uses its recipient's row index, even when names match. The QR encodes a Singapore mobile proxy, SGD currency (`702`), a fixed amount, and an EMVCo CRC-16/CCITT-FALSE checksum. The bank resolves the registered recipient name; Settle does not claim that a user-entered name is bank verified. Codes do not expire and can be reused, so check for duplicate payments.

QR encoding and decoding tests run with `npm test`. Actual bank-app acceptance, photo import, and native file sharing need device testing. The feature is labelled beta until that testing is complete; no payment is ever initiated automatically or marked confirmed.

Vercel Web Analytics is loaded through `@vercel/analytics`. Visitors can disable analytics from the Cookie Policy page. Calculator data stays in browser local storage.

The included Privacy Policy, Cookie Policy, and Terms are project templates and should be reviewed by a qualified professional before commercial use.
