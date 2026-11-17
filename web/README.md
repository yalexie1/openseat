# OpenSeat

Browser alerts when a full Yale class opens a seat. You enroll yourself in Yale Course Search — OpenSeat never logs in or registers for you.

## Run

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo

1. Enter your email in **Alert email** (saved in the browser).
2. Click **Enable browser pings** and allow notifications.
3. Search a real Spring 2027 YC course (e.g. `PHIL 1176`).
4. Add it to the watchlist (starts as FULL).
5. Click **Simulate open** — browser ping + email + on-page alert.

Without `RESEND_API_KEY`, email goes to an Ethereal test inbox and the UI shows **Open email preview**. For real inboxes, copy `.env.local.example` → `.env.local` and set a [Resend](https://resend.com) API key.

## Data

- Course names: CourseTable public catalog `202701` (Spring 2027), Yale College only, cached at `public/catalog-202701.json`.
- Live registrar open/full probes are blocked by Yale’s WAF from most servers; the poll loop uses demo overrides so the pitch still works.