# MG Teacher

An offline-first teacher management app built for Albanian schools. Teachers can manage classes, students, grades, attendance, weekly lesson plans, assessments, and parent contact logs — all from a browser, with data syncing to a PostgreSQL backend when online.

## Features

- **Dashboard** — live stats: total students, classes, today's schedule, at-risk students
- **Classes & Students** — full CRUD, CSV bulk import, per-student profiles
- **Grades** — 1–5 scale grid per class/term, trend arrows on student profiles
- **Attendance** — mark present/absent/excused per period, bulk actions, absences summary
- **Assessments** — numeric scores (quiz, test, exam, homework) with percentage tracking
- **Weekly Plans** — lesson planning per class/week with PDF and Word export
- **Reports** — class overview with subject averages, Excel and PDF export
- **Conduct & Contact logs** — per-student behavior notes and parent contact history
- **Progress report PDF** — printable per-student report with grades and attendance
- **Global search** — Cmd/Ctrl+K to search students instantly
- **Teacher management** — admin-only CRUD for teacher accounts
- **Offline-first** — IndexedDB (Dexie) with last-write-wins sync to Postgres
- **Bilingual** — English and Albanian (🇬🇧 / 🇦🇱) with instant toggle

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Local DB | Dexie.js (IndexedDB) |
| Sync | Custom LWW push/pull engine |
| Backend | Fastify (Node.js) |
| Database | PostgreSQL + Drizzle ORM |
| Auth | JWT (HS256) |
| i18n | i18next + react-i18next |
| Exports | jsPDF, jspdf-autotable, SheetJS, docx |
| Monorepo | pnpm workspaces |

## Project structure

```
mg-teacher/
├── apps/
│   ├── api/          # Fastify backend
│   │   ├── drizzle/  # SQL migration files
│   │   └── src/
│   │       ├── routes/   # auth, sync, admin
│   │       ├── db.ts
│   │       ├── migrate.ts
│   │       └── seed.ts
│   └── web/          # React frontend
│       └── src/
│           ├── components/
│           ├── context/   # Auth, Sync
│           ├── lib/       # local-db, sync-engine, i18n, exports
│           ├── locales/   # en.json, sq.json
│           └── pages/
└── packages/
    ├── db/    # Drizzle PostgreSQL schema (shared)
    └── types/ # Shared TypeScript types
```

## Prerequisites

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- PostgreSQL 15+ running locally or via Docker

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd mg-teacher
pnpm install
```

### 2. Configure environment

Create `apps/api/.env`:

```env
DATABASE_URL=postgres://postgres:password@localhost:5432/mg_teacher
JWT_SECRET=change-me-in-production
PORT=3000
```

Optional settings:

| Variable | Default | Purpose |
|---|---|---|
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated list of origins allowed to call the API. Set this to your frontend's real origin when deploying. |
| `SEED_DEFAULT_ADMIN` | `true` outside production | Whether to seed the default admin into an empty database. |
| `DEFAULT_ADMIN_EMAIL` | `teacher@school.com` | Email for the seeded admin. |
| `DEFAULT_ADMIN_PASSWORD` | `password123` | Password for the seeded admin. |

**Before deploying:**

- `JWT_SECRET` is **required** when `NODE_ENV=production` — the server refuses
  to start without it. Anyone who knows the signing secret can mint a token
  for any user with any role, so it must not be the value above.
- The default admin is only seeded into a database with no users at all, and
  only outside production unless you set `SEED_DEFAULT_ADMIN=true`. If you do
  seed it, change the password immediately from the Teachers page.

### 3. Create the database

**Option A — Docker (recommended, no install needed):**

```bash
docker run -d --name pg -e POSTGRES_PASSWORD=password -e POSTGRES_DB=mg_teacher -p 5432:5432 postgres:15
```

**Option B — Local PostgreSQL:**

First install PostgreSQL if you haven't already:

```bash
# macOS
brew install postgresql@15
brew services start postgresql@15
echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Ubuntu/Debian
sudo apt install postgresql
```

Then create the database:

```bash
createdb -U postgres mg_teacher
```

### 4. Run migrations

```bash
cd apps/api
pnpm db:migrate
```

### 5. Default admin account

The API seeds a default admin automatically every time it starts (safe to
run repeatedly — it's a no-op once the account exists), so there's no manual
step here. It's also shown directly on the login screen via a "Log in as
admin" button.

| Field | Value |
|---|---|
| Email | `teacher@school.com` |
| Password | `password123` |
| Role | `admin` |

To (re-)create it without starting the server, e.g. against a database that
predates this account: `cd apps/api && pnpm db:seed`.

### 6. Start dev servers

Open two terminals:

```bash
# Terminal 1 — API (port 3000)
pnpm dev:api

# Terminal 2 — Web (port 5173)
pnpm dev:web
```

Then open [http://localhost:5173](http://localhost:5173).

The web app proxies all `/api/*` requests to the API, so no CORS issues in dev.

## Available scripts

Run from the repo root unless noted.

| Command | What it does |
|---|---|
| `pnpm dev:api` | Start API in watch mode |
| `pnpm dev:web` | Start Vite dev server |
| `pnpm build:web` | Production build of the frontend |
| `pnpm build:api` | Compile API TypeScript |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm format` | Format all files with Prettier |

Run from `apps/api/`:

| Command | What it does |
|---|---|
| `pnpm db:migrate` | Apply pending SQL migrations |
| `pnpm db:seed` | Insert default test account |
| `pnpm db:generate` | Regenerate migration files from schema (requires drizzle-kit) |

## Adding new migrations

1. Add the new table or column to `packages/db/src/pg-schema.ts`
2. Create `apps/api/drizzle/000N_description.sql` with the SQL (`CREATE TABLE IF NOT EXISTS …`)
3. Add an entry to `apps/api/drizzle/meta/_journal.json`
4. Migrations run automatically on the next `pnpm dev:api` or `pnpm start`

## Sync model

The app works fully offline. All writes go to IndexedDB first with `syncStatus: 'pending'`. When online, the sync engine:

1. **Push** — sends all pending records to `POST /api/sync/push` (last-write-wins by `updatedAt`)
2. **Pull** — fetches all records updated since last sync from `GET /api/sync/pull?since=<ISO>`

Sync runs automatically on login and after every local write. Deletes are soft — records get a `deletedAt` timestamp and are excluded from queries.

## Default ports

| Service | Port |
|---|---|
| Web (Vite) | 5173 |
| API (Fastify) | 3000 |
| PostgreSQL | 5432 |
