# Hirely

A small hiring tool for one recruiter: log in, add candidates, move them through
**Applied → Screening → Interview → Offer → Hired / Rejected**, search and filter, keep notes,
and watch a dashboard. Works on a phone as well as a laptop.

Stack: **Python + JavaScript only.** React, Vite, react-router-dom, @dnd-kit on the front;
FastAPI, SQLAlchemy, SQLite, argon2, Alembic, pytest on the back. No TypeScript, UI library,
Tailwind or Docker. The funnel is plain CSS.

## Three key design decisions

1. **Server-side sessions, not JWT.** The cookie holds a random token; the database holds only a
   keyed hash of it. Logging out deletes the row, so a session can be revoked instantly (a JWT
   cannot be revoked before it expires). For one small app the extra table is cheaper than the
   revocation problem.
2. **One file owns the stage rules.** `backend/app/stages.py` decides every legal move: forward
   one step, back one step to fix a mistake, Rejected from any stage except Hired, Hired is
   final, and Rejected can be reopened to Applied. The API sends each candidate's
   `allowed_moves`; the Advance button, the stepper and the Kanban board only show what the
   server says, so they can never disagree. The server re-checks every move anyway.
3. **SQLite now, PostgreSQL when you outgrow it.** SQLite is a single file, needs no server and
   is plenty for one recruiter. Move to PostgreSQL when you need several app servers, many
   concurrent writers, real full-text search, or backups and replicas. Only `DATABASE_URL` and
   the driver should need to change, because SQLAlchemy and Alembic do the rest.

## Prerequisites

- Python 3.10 to 3.13
- Node.js 18 or newer (20 or 22 recommended) with npm
- VS Code (any terminal works)

## Setup (development)

Open the `hirely` folder in VS Code, then open the integrated terminal (Ctrl+`).

Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# edit .env: set SECRET_KEY (long random text) and DEMO_PASSWORD
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

macOS / Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env: set SECRET_KEY (long random text) and DEMO_PASSWORD
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and sign in with the demo user:

- email: `demo@hirely.test` (or whatever `DEMO_EMAIL` is in `.env`)
- password: the `DEMO_PASSWORD` you set in `.env`

If PowerShell refuses to run `Activate.ps1`, run
`Set-ExecutionPolicy -Scope Process RemoteSigned` once in that terminal and try again.

API docs (FastAPI's generated page): http://127.0.0.1:8000/docs

### Production-style run (one server)

```bash
cd frontend
npm install
npm run build
cd ../backend
uvicorn app.main:app
```

Open http://127.0.0.1:8000. The backend serves the built app from `frontend/dist` when that
folder exists. Behind HTTPS set `HIRELY_ENV=production` in `.env` so cookies get the `Secure` flag.

### Tests

**Backend (pytest, 57 tests, 90% coverage):**

```bash
cd backend
pytest -v
pip install pytest-cov
pytest --cov=app --cov-report=term-missing
```

The tests build a temporary SQLite file by running the real Alembic migration (there is no
`create_all()` anywhere), so they also check that the migration works. They cover stage rules,
login and lockout, CSRF, sessions (including expiry), candidate create/update/archive, search and
wildcard escaping, stage filter, pagination, notes, input validation, and dashboard numbers.

**Browser end-to-end (Playwright, 11 tests):** start the backend (port 8000) and the frontend
(port 5173), then in a third terminal:

```
cd frontend
npm install
npx playwright install chromium
$env:E2E_PASSWORD="your DEMO_PASSWORD"     # PowerShell; macOS/Linux: export E2E_PASSWORD=...
npx playwright test
npx playwright show-report
```

Set `E2E_EMAIL` too if your demo email is not `demo@hirely.test`. The tests cover login, redirect
when signed out, sign out, form validation, the full candidate lifecycle (add, move stage, edit,
note, archive), duplicate email, search with stage filter, dashboard counts, the board columns,
and no sideways scrolling on a phone-sized screen. They create `QA ...` candidates through the
API and archive them afterwards.

Not covered: drag and drop on the board (the stage rules behind it are covered by the backend
tests), load testing, and browsers other than Chromium.

## Screenshot

_Placeholder: no screenshot has been captured yet. Run the app and add one here as
`docs/screenshot.png`._

## Features and rules

- **Screens:** Login, Dashboard, Candidates, Candidate detail, Board. Every screen has loading
  (shimmer skeleton), error (with retry) and empty states ("No candidates yet", "No results for
  this search").
- **Search:** one box, run on the server with SQL `LIKE` over name, email, role and skills. It waits
  300 ms after typing stops. `%` and `_` typed by the user are escaped, so they search literally.
  Results are paginated, 20 per page. The stage filter works together with search.
- **Hire rate:** `hired ÷ active`, where *active* means **not archived and not Rejected** (Hired
  candidates count as active). The dashboard card prints the formula with the real numbers. If
  there are no active candidates it shows 0%.
- **Funnel:** each bar is the number of candidates who ever reached that stage; the average days
  beside it is the mean time candidates spent in the stage (current stays count up to now). Hired
  is final, so it shows "-".
- **Archive, not delete.** Archiving asks for confirmation, hides the candidate from lists and the
  board, and keeps the history. There is no restore in this version.
- **Reserved emails.** Emails are unique, stored lower case. **An archived candidate's email stays
  reserved**, so adding the same email again is rejected with a clear message next to the field.
- **Form errors** for email and phone (and name and role) appear next to the field, checked in the
  browser and again on the server.
- **History:** creating a candidate writes the first row (nothing → Applied). `seed.py` uses the
  same `create_candidate` and `move_stage` functions as the API, so the demo funnel is correct.
- **Board:** drag a card to move it. The card moves at once; if the server refuses, only that card
  snaps back and an error is shown. While dragging, valid columns are highlighted green and
  invalid ones are dimmed and red. Sensors: mouse, touch (press about 200 ms to pick up, so
  scrolling still works) and keyboard (focus a card, Space, arrow keys, Space).

## Security

- **Passwords** are stored only as **argon2** hashes. Argon2 is memory-hard, which makes
  large-scale GPU guessing far more expensive than with older fast hashes, and it won the
  Password Hashing Competition. `argon2-cffi` picks safe default parameters and a random salt per
  password. Unknown emails are verified against a dummy hash so timing does not reveal which emails exist.
- **Sessions** live on the server. The cookie holds a random token, the database stores only its
  HMAC-SHA256 hash (keyed with `SECRET_KEY`). Sessions expire after 7 days; logout deletes the row.
- **Cookie flags:** `HttpOnly`, `SameSite=Lax`, and `Secure` when `HIRELY_ENV=production`.
- **CSRF:** every non-GET request must carry the custom header `X-Requested-With: hirely`, which
  other websites cannot send, on top of `SameSite`.
- **Every route** except login checks who you are.
- **Input** is validated before it touches the database, and all queries are parameterized.
- **Secrets** live in `.env`, which is never committed (`.env.example` is the template).
- **Headers:** `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, a Content-Security-Policy
  (not applied to `/docs`, which loads Swagger UI from a CDN) and HSTS in production.
- **Login lockout:** Login is limited per email and IP together: 5 failed attempts from the same
  email and IP block that pair for 15 minutes, so a stranger on another IP cannot lock out the real user.
  The counter is in memory, resets on a successful login and on restart. The IP is the direct
  connection address; behind a reverse proxy configure the proxy headers first (see Known limits).

## Project layout

```
backend/app/      main, config, database, models, schemas, security, deps, stages, seed
backend/app/routes/   auth, candidates, notes, dashboard
backend/alembic/  env.py and versions/0001_initial.py (the only way tables are created)
backend/tests/    test_stages, test_candidates, test_auth, test_edge_cases
frontend/e2e/     hirely.spec.js (Playwright), with playwright.config.js in frontend/
frontend/src/     App, api, useApi, useAuth, styles.css
frontend/src/components/   Button, Badge, Card, Field, DataTable, Modal, States,
                           Layout, CandidateForm, StageBar, FunnelChart, NotesPanel, KanbanBoard
frontend/src/screens/      Login, Dashboard, Candidates, CandidateDetail
```

## What was cut and why

- Restore for archived candidates, roles/permissions, password change: not needed for one
  recruiter and a six-hour scope.
- A "Board" page size above 200: the board loads up to 200 candidates and says so if there are more.
- Real-time updates, file uploads (CVs), email sending, and charts beyond the CSS funnel.
- Extra build tooling (linting, formatting, TypeScript, component library) to stay inside the stack.

## Known limits

- The login rate limit works for a **single server process only** (in-memory), and is lost on restart.
- Behind a reverse proxy every request may look like one IP; configure the proxy and the app's
  client-IP handling before relying on the per-IP part of the lockout.
- **No restore** for archived candidates.
- Skills are a plain text column searched with `LIKE`; at scale they would be normalized into
  their own table (or use full-text search).
- No roles: every signed-in user can do everything.
- No forced password change for the demo user.
- No concurrent-edit handling: the last save wins.
- Notes can be deleted without a confirmation step.
- The Board shows the newest 200 candidates only.

## Verification status

Verified on Windows: `pytest` (57 passed, 90% coverage) and `npx playwright test` (11 passed)
against a running backend and frontend. Touch dragging on a real phone has not been tested by hand.
