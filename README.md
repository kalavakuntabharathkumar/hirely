# Hirely

Hirely is a small hiring tool I built for a single recruiter. You log in, add candidates, move them through the hiring stages (Applied, Screening, Interview, Offer, Hired or Rejected), search and filter them, leave notes, and check a dashboard with the numbers. It works on a phone as well as a laptop.

Live demo: https://YOUR-APP-NAME.onrender.com

Demo login (a demo account with sample data only, so the password is shared on purpose):

- Email: `demo@hirely.test`
- Password: `Bhavani1@`

The free hosting may be asleep, so the first load can take up to a minute.

The stack is Python and JavaScript only. The frontend is React with Vite, react-router-dom and @dnd-kit for the drag-and-drop board. The backend is FastAPI with SQLAlchemy, SQLite, Alembic for migrations, argon2 for passwords and pytest for tests. I didn't use TypeScript, a UI library, Tailwind or Docker. The funnel chart on the dashboard is plain CSS.

## Screenshot

<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/a1c2cc9d-c8a4-47e4-bc1b-1a65f183efc1" />

<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/f62d30f9-c46a-4880-acdc-61a646c91a80" />

<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/39af4bdf-3a24-4855-b52f-c3e8c8655442" />


## Three decisions I made

**Sessions instead of JWT.** The cookie only holds a random token, and the database stores a hashed copy of it. When someone logs out I delete the row, so the session is dead straight away. A JWT can't be cancelled before it expires, and for a small app one extra table is a better deal than that problem.

**One file decides the stage rules.** `backend/app/stages.py` is the only place that says which moves are allowed: one step forward, one step back to fix a mistake, Rejected from any stage except Hired, Hired is final, and a Rejected candidate can be reopened to Applied. The API sends each candidate's `allowed_moves`, and the buttons, the stepper and the Kanban board only show what the server allows. That way the screens can't disagree with each other. The server checks every move again anyway.

**SQLite now, PostgreSQL later.** SQLite is a single file and needs no server, which is plenty for one recruiter. If this grew to several app servers, many people writing at once, real full-text search or backups, I would move to PostgreSQL. Only `DATABASE_URL` and the driver should need to change.

## Running it

You need Python 3.10 to 3.13 and Node.js 18 or newer.

Backend, Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# open .env and set SECRET_KEY (long random text) and DEMO_PASSWORD
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

Backend, macOS or Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# open .env and set SECRET_KEY (long random text) and DEMO_PASSWORD
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

Frontend, in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and sign in with `demo@hirely.test` (or whatever `DEMO_EMAIL` is in your `.env`) and the `DEMO_PASSWORD` you chose.

If PowerShell won't run `Activate.ps1`, run `Set-ExecutionPolicy -Scope Process RemoteSigned` once in that terminal and try again. The generated API docs are at http://127.0.0.1:8000/docs.

### Running it as one server

```bash
cd frontend
npm install
npm run build
cd ../backend
uvicorn app.main:app
```

Then open http://127.0.0.1:8000. The backend serves the built frontend from `frontend/dist` when that folder exists. If you run it behind HTTPS, set `HIRELY_ENV=production` in `.env` so the cookie gets the `Secure` flag.

## Tests

I tested the backend with pytest and the whole app in a real browser with Playwright. Both suites passed on my Windows machine.

**Backend: 57 tests, 90% coverage.**

```bash
cd backend
pytest -v
pip install pytest-cov
pytest --cov=app --cov-report=term-missing
```

Every test builds a fresh temporary SQLite file by running the real Alembic migration (there is no `create_all()` anywhere), so the tests also prove the migration works. They cover the stage rules, login and lockout, the CSRF header, sessions including expiry, creating, editing and archiving candidates, search and wildcard escaping, the stage filter, pagination, notes, input validation and the dashboard numbers.

**Browser: 11 Playwright tests.** Start the backend on port 8000 and the frontend on port 5173, then in a third terminal:

```
cd frontend
npm install
npx playwright install chromium
$env:E2E_PASSWORD="your DEMO_PASSWORD"
npx playwright test
npx playwright show-report
```

That `$env:` line is PowerShell. On macOS or Linux use `export E2E_PASSWORD=...` instead. If your demo email isn't `demo@hirely.test`, set `E2E_EMAIL` as well.

These tests click through login, the redirect when you're signed out, sign out, form errors, the full candidate lifecycle (add, move stage, edit, add a note, archive), a duplicate email, search with the stage filter, the dashboard counts, the board columns, and a check that nothing scrolls sideways at phone width. They create their own `QA ...` candidates through the API and archive them when they finish.

What I did not test: dragging cards on the board (the stage rules behind it are covered by the backend tests), load, and browsers other than Chromium.

## What the app does

- **Screens:** Login, Dashboard, Candidates, Candidate detail and Board. Each one has a loading state, an error state with a retry button, and an empty state.
- **Search:** one box that searches name, email, role and skills on the server using SQL `LIKE`. It waits 300 ms after you stop typing. A `%` or `_` you type is searched literally, not treated as a wildcard. Results come 20 per page, and the stage filter works together with the search.
- **Hire rate:** hired divided by active, where active means not archived and not Rejected. The dashboard card shows the formula with the real numbers. With no active candidates it shows 0%.
- **Funnel:** each bar counts the candidates who ever reached that stage, and the days next to it are the average time spent there.
- **Archiving:** I archive instead of deleting. It asks for confirmation, hides the candidate from the lists and the board, and keeps the history. There is no restore yet.
- **Emails:** they are unique and stored in lower case. An archived candidate's email stays reserved, so adding it again shows an error next to the field.
- **Forms:** errors for name, email, phone and role show next to the field. They are checked in the browser and again on the server.
- **History:** creating a candidate writes the first history row. `seed.py` uses the same `create_candidate` and `move_stage` functions as the API, so the demo funnel is correct.
- **Board:** drag a card to move it. The card moves right away, and if the server says no, only that card snaps back and an error appears. Valid columns turn green while you drag and invalid ones are dimmed. It works with a mouse, with touch (press for about 200 ms so scrolling still works), and with the keyboard.

## Security

- Passwords are stored only as argon2 hashes, with a random salt for each one. If someone logs in with an email that doesn't exist, I still check the password against a dummy hash, so the response time doesn't reveal which emails are real.
- Sessions live on the server. The database stores only an HMAC-SHA256 hash of the cookie token, keyed with `SECRET_KEY`. Sessions last 7 days and logout deletes the row.
- The cookie is `HttpOnly` and `SameSite=Lax`, and it is `Secure` when `HIRELY_ENV=production`.
- Every request that isn't a GET must send the header `X-Requested-With: hirely`. Other websites can't send that header, so it works as CSRF protection on top of `SameSite`.
- Every route except login checks who you are.
- Input is validated before it reaches the database, and every query is parameterized.
- Secrets live in `.env`, which is never committed. `.env.example` is the template.
- The app sends the usual security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, a Content-Security-Policy (left off `/docs`, which loads Swagger UI from a CDN) and HSTS in production.
- Login attempts are limited per email and IP together. Five failures from the same pair block that pair for 15 minutes, so a stranger on another IP can't lock the real user out. The counter is kept in memory and resets on a successful login or a restart.

## Project layout

```
backend/app/              main, config, database, models, schemas, security, deps, stages, seed
backend/app/routes/       auth, candidates, notes, dashboard
backend/alembic/          env.py and versions/0001_initial.py (the only way tables get created)
backend/tests/            test_stages, test_candidates, test_auth, test_edge_cases
frontend/e2e/             hirely.spec.js (Playwright); the config is frontend/playwright.config.js
frontend/src/             App, api, useApi, useAuth, styles.css
frontend/src/components/  Button, Badge, Card, Field, DataTable, Modal, States, Layout,
                          CandidateForm, StageBar, FunnelChart, NotesPanel, KanbanBoard
frontend/src/screens/     Login, Dashboard, Candidates, CandidateDetail
```

## What I left out

I left out restoring archived candidates, roles and permissions, and changing your password, because none of them matter for a tool with one recruiter. I also skipped real-time updates, CV uploads, sending email, and any charts beyond the CSS funnel. And I kept extra tooling like linting, TypeScript and a component library out so the project stays inside the Python and JavaScript stack.

## Known limits

- The login lockout works for one server process only, and it is lost on restart.
- Behind a reverse proxy every request can look like it comes from one IP, so the per-IP part of the lockout needs the proxy set up properly first.
- Archived candidates can't be restored.
- Skills are one plain text column searched with `LIKE`. At a larger scale they would get their own table or full-text search.
- There are no roles, so every signed-in user can do everything.
- The demo user is never forced to change the password.
- If two people edit the same candidate, the last save wins.
- Notes are deleted without asking for confirmation.
- The board shows the newest 200 candidates only.
- I haven't tested touch dragging by hand on a real phone.
