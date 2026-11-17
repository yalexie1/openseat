# OpenSeat (`web/`)

Next.js app for [OpenSeat](https://openseat.vercel.app). See the [root README](../README.md) for the full pitch.

```bash
npm install
cp .env.local.example .env.local   # RESEND_API_KEY
npm run dev
```

- Catalog: `public/catalog-202701.json` (Spring 2027 YC)
- Alerts: `src/lib/notify.ts` (browser), `src/app/api/email/route.ts` (Resend)
- UI: `src/components/OpenSeatApp.tsx`
