# Handyman Quote Generator
### A Lineage Labs Platform

A mobile-first quoting tool for handymen and contractors. Voice-to-text job assessment, smart pricing templates, instant PDF delivery, and win/loss analytics.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (Postgres + RLS) |
| Auth | Supabase Auth |
| Deployment | Vercel |
| Email | Resend |
| Voice | Web Speech API + OpenAI Whisper fallback |
| PDF | React-PDF |
| Charts | Recharts |

---

## Local Setup

```bash
git clone https://github.com/lineage-labs/handyman-quote.git
cd handyman-quote
npm install
cp .env.example .env.local
# Fill in Supabase, Resend, and OpenAI keys
npm run dev
```

Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor before starting.

---

## Phase 1 Roadmap

- [x] Project scaffold and database schema
- [ ] Auth (login, register, onboarding)
- [ ] Client intake form
- [ ] Voice recorder + transcript editing
- [ ] Pricing template manager
- [ ] Quote builder with line item editor
- [ ] PDF generation + email delivery
- [ ] Analytics dashboard
- [ ] Beta onboarding (free trial)
