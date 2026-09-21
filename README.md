# 🚢 Eventship

> **The command center for event teams.** Build events. Ship on time.

A production-grade, full-stack event management system — live task boards, real-time dashboards, team coordination, blocker tracking and notifications, wrapped in a multi-tenant workspace ("Room") model with role-based access control.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)
![Bun](https://img.shields.io/badge/Bun-runtime-F9F1E1?logo=bun)

---

## ✨ Features

### Planning & Tracking
- 📊 **Live dashboard** — completion rate, blocked/overdue counters, status & priority charts, 14-day completion trend, team workload and a top-performers leaderboard
- ✅ **Task management** — Kanban board with drag-and-drop, task dependencies (a task can't be completed while its dependencies are unfinished — server-enforced), priorities, comments, activity history
- 📅 **Events & calendar** — event lifecycle (Planning → In Progress → Completed), month calendar view with **.ics export** for every app
- 🔍 **Global search** — ⌘K command palette across tasks, events and members

### Team Coordination
- 👥 **Teams & RBAC** — three roles: **Event Manager**, **Team Leader**, **Employee**, each with distinct permissions enforced server-side
- 🏠 **Rooms (multi-tenancy)** — every workspace is a Room: create your own or join one with a **room code + password** (`EVT-XXXXXX`). All data is strictly room-scoped
- 🔔 **Notifications** — assignment, status-change, deadline and blocker alerts with per-user preferences
- 📜 **Activity audit log** — who did what, when, filterable, with CSV export

### Platform
- ⚡ **Real-time** — LIVE badge via a dedicated socket.io microservice, with automatic polling fallback when websockets aren't available (e.g. serverless hosting)
- 🌗 **Dark / light mode** — fully calibrated oklch theme, charts included
- 🔐 **Security** — scrypt password hashing, DB-backed httpOnly session cookies, rate limiting, password-strength enforcement, forgot/reset-password flow, session management
- 📤 **Exports** — CSV (tasks, events, audit) and ICS (calendar)
- 👤 **Profiles** — avatar upload and cover-background picker
- 📱 **Responsive** — mobile-first layout, keyboard shortcuts, screen-reader friendly

---

## 🔑 Demo Accounts

| Role | Email | Password |
|---|---|---|
| Event Manager | `admin@eventship.io` | `password123` |
| Employee | `david@eventship.io` | `password123` |

Demo room: **`EVT-DEM258`** (join password: `demo1234`) — "Eventship Demo HQ"

The login page includes a one-click **"Use demo account"** button.

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack, standalone output) |
| UI | **React 19**, **TypeScript 5**, **Tailwind CSS 4**, **shadcn/ui** (Radix primitives), **Lucide** icons |
| State | **Zustand** (client), **TanStack Query** (server state), **TanStack Table** |
| Charts | **Recharts** |
| Motion | **Framer Motion** |
| Forms | **react-hook-form** + **Zod 4** |
| Drag & drop | **@dnd-kit** |
| Database | **Prisma ORM 6** → SQLite (dev) / **PostgreSQL** (production-ready, e.g. Neon) |
| Auth | Custom scrypt + DB-backed session cookies + RBAC (no third-party auth service) |
| Realtime | **socket.io** microservice (separate Bun process) + polling fallback |
| Tooling | **Bun** (packages, dev server, test runner), ESLint 9 |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 20+** (`nodejs.org`) — *or* **Bun 1.1+** (`bun.sh`)
- That's it. SQLite is file-based and needs no setup for local development.

### 1. Install
```bash
npm install          # or: bun install
```

### 2. Environment
Create a `.env` file in the project root:
```env
DATABASE_URL="file:./db/custom.db"
```
> For local development with SQLite, `file:./db/custom.db` works out of the box.
> See [.env.example](./.env.example) for reference.

### 3. Create the database + demo data
```bash
npm run db:push      # or: bun run db:push  → creates all tables
npx tsx prisma/seed.ts   # fills demo data (users, events, tasks, room)
```
The seed prints the demo login credentials when it finishes.

### 4. Run
```bash
npm run dev          # or: bun run dev
```
Open **http://localhost:3000** and sign in with a demo account.

---

## 📜 Scripts

| Command | What it does |
|---|---|
| `dev` | Start the dev server (port 3000) |
| `build` | Production build (standalone output) |
| `start` | Run the standalone production server (Bun) |
| `lint` | ESLint check |
| `test` | Run the test suite (`bun test`) |
| `db:push` | Push the Prisma schema to the database |
| `db:generate` | Generate the Prisma client |
| `db:migrate` | Create/apply a dev migration |

---

## 🗄 Database Schema (11 models)

```
User ──┬── Session, PasswordResetToken, Notification
       ├── Team (membership)
       └── Room (membership + ownership)   ← multi-tenant workspace
Event ── Task ──┬── TaskComment
                ├── TaskDependency (DAG)
                └── Assignment (User)
ActivityLog (audit trail) · Notification (per-user prefs)
```
Full definitions: [`prisma/schema.prisma`](./prisma/schema.prisma)

---

## 🏗 Project Structure

```
src/
├── app/            # App Router: shell, /api/* route handlers, metadata
│   └── api/        # auth · users · teams · events · tasks · calendar
│                   # dashboard · notifications · activity · search · rooms · health
├── components/
│   ├── ui/         # shadcn/ui library
│   ├── pages/      # feature pages (Dashboard, Tasks, Events, Calendar…)
│   ├── landing/    # public marketing site + blog
│   ├── layout/     # app shell (sidebar, topbar, command palette)
│   └── shared/     # cross-feature widgets
├── lib/            # auth, db, permissions, rate-limit, schemas, csv/ics, realtime
├── stores/         # Zustand stores
├── hooks/          # custom hooks (hash router, shortcuts, debounce…)
├── types/          # shared DTOs
└── content/        # blog content
mini-services/
└── realtime-service/  # standalone socket.io server (Bun)
```

### Routing
The app uses **hash-based SPA routing** (`#/login`, `#/dashboard`, `#/tasks`, `#/events`, `#/calendar`, `#/teams`, `#/admin`, `#/onboarding`) inside a single App Router shell — instant navigation, zero server round-trips per page change.

---

## 🔌 API Overview

All endpoints are JSON REST under `/api/*`, validated with Zod and room-scoped:

| Group | Highlights |
|---|---|
| `/api/auth/*` | register, login, logout, me, forgot/reset password, sessions, onboarding-status |
| `/api/rooms/*` | create room, join by code, room settings |
| `/api/tasks/*` | CRUD, status transitions, dependencies, comments |
| `/api/events/*` | CRUD, status lifecycle, per-event task boards |
| `/api/teams/*` | teams, members, workload |
| `/api/dashboard` | aggregated stats & chart series |
| `/api/calendar` | month view feed (ICS export) |
| `/api/notifications` | list, read, per-user preferences |
| `/api/activity` | audit feed + CSV export |
| `/api/search` | global search across room data |

---

## ⚡ Realtime Architecture

```
Browser ⇄ socket.io (mini-services/realtime-service, own port)
       ⇅ gateway-routed in the sandbox · polling fallback (~30 s) elsewhere
```
Every mutation emits a room-scoped event; clients that can't hold a websocket (e.g. Vercel serverless) automatically degrade to polling — the app stays fully functional.

---

## 📦 Production Deployment (Vercel + Neon — free)

Short version; do these in order:

1. **Switch the DB provider** — in `prisma/schema.prisma`, change `provider = "sqlite"` → `provider = "postgresql"`.
2. **Create a free Postgres** at [neon.tech](https://neon.tech) → copy both connection strings (**pooled** has `-pooler` in the host, **direct** doesn't).
3. **Local setup & seed** — put the **direct** string in `.env`, then:
   ```bash
   npx prisma db push
   npx tsx prisma/seed.ts
   ```
4. **Push to GitHub** and **import the repo** at [vercel.com](https://vercel.com).
5. **Vercel env vars** — `DATABASE_URL` = the **pooled** string.
6. **Build command override** — `npx prisma generate && next build`.

> ℹ️ On Vercel the LIVE badge uses polling fallback (~30 s) since serverless can't host websockets. Everything else works identically.
> Neon free tier sleeps after ~5 min idle — the first request after a pause takes 1–2 s to wake it.

### 🩺 Deployed site returns 500 on login/register? Self-diagnose

Open **`/api/health`** on the deployed URL. It runs four checks in order and names the exact fix:

| Failed check | Meaning | Fix |
|---|---|---|
| `databaseUrl` | `DATABASE_URL` env var missing on the host | Add it in host dashboard (Vercel → Settings → Environment Variables), then **redeploy** |
| `databaseUrl.hint` mentions serverless | SQLite selected on a read-only/ephemeral filesystem | Do step 1 (switch to `postgresql`) — SQLite **cannot** work on Vercel/Netlify |
| `prismaClient` | Prisma client wasn't generated during install | Run `npx prisma generate` locally + commit, or set build command to `npx prisma generate && next build` (a `postinstall` script now handles this automatically) |
| `database` | DB unreachable (wrong host / asleep / allow-list) | Check the connection string (pooled for Vercel), DB is awake, network access |
| `schema` | DB reachable but tables missing | `npx prisma db push` against that database, then optionally seed |

Auth endpoints also return these same hints as `503` messages (visible in the browser Network tab) instead of a bare `500`.

**Self-hosting with SQLite instead** (Render / Railway / Fly / VPS): keep `provider = "sqlite"`, set `DATABASE_URL="file:./db/custom.db"` on a **persistent writable disk**, run `npx prisma db push && npx tsx prisma/seed.ts` once, then `npm run build && npm start`. Never commit a live database in production use.

---

## 🧪 Testing

```bash
bun test        # 82 tests · 257 assertions
```
Suites: `auth` · `crud` · `rbac` · `rooms` · `security` · `unit`

---

## 📄 License

Provided as-is for demonstration and educational purposes. Add your own license before commercial use.
