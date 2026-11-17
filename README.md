# OpenSeat

Watch full Yale classes. Get a **browser ping + email** the second a seat opens — then you register yourself in Yale Course Search.

OpenSeat never logs into Yale and never enrolls for you.

**Live:** [https://openseat.vercel.app](https://openseat.vercel.app)

Built at a Grok hackathon with [Grok](https://grok.x.ai) in Cursor:

![Building OpenSeat with Grok](docs/built-with-grok.png)

## Quick demo

1. Open [https://openseat.vercel.app](https://openseat.vercel.app).
2. Enter your alert email (with Resend’s test sender, use the email on your Resend account).
3. Click **Enable browser pings** and allow notifications.
4. Search a Spring 2027 course, e.g. `PHIL 1176` (Death — Shelly Kagan).
5. Add it to the watchlist, then click **Simulate open**.
6. You’ll get an on-page alert, a browser notification, an email, and a link into Course Search.

## Why it exists

During add/drop, seats open and disappear in seconds. Students refresh Yale Course Search and still miss classes. OpenSeat keeps a personal watchlist and alerts you the moment status flips so you can claim the seat yourself.

## What it does

| Feature | Detail |
|---|---|
| Real catalog | Spring 2027 Yale College courses from [CourseTable](https://coursetable.com)’s public data |
| Watchlist | Saved in your browser (localStorage) |
| Browser ping | Notification API + sound + tab title flash |
| Email | Resend (`RESEND_API_KEY`) |
| Register link | Deep link to [Yale Course Search](https://courses.yale.edu/) for that course |
| Demo mode | **Simulate open** forces a full → open flip for pitches |

## Run locally

```bash
cd web
npm install
cp .env.local.example .env.local   # add RESEND_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

Next.js · TypeScript · Tailwind · Resend · CourseTable catalog · Vercel

## Notes

- Catalog term: **Spring 2027** (`202701`), file `web/public/catalog-202701.json`.
- Live Yale open/full probes are blocked by Course Search’s WAF from most servers; the product loop is watch → status change → alert, with **Simulate open** for demos.
- Resend’s `onboarding@resend.dev` sender only delivers to your Resend account email until you verify your own domain.

## Repo

App code lives in [`web/`](web/). Hackathon agent board helpers are in `tools/board` — see [`AGENTS.md`](AGENTS.md).
