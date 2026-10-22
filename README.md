# Ithraa · الإثراء المعرفي

A six-year enrichment program platform (Grades 7–12) with three connected roles — **Student**, **Teacher**
and **Admin** (program coordinator) — plus the adaptive **discovery assessment** taken by Grade 6 nominees.
Built from the interactive prototype in `ithraa-platform-demo.html`.

```
apps/
  api/   FastAPI + SQLAlchemy 2 + PostgreSQL (Alembic migrations, seed, pytest)
  web/   React 18 + TypeScript + Vite + React Query
docker-compose.yml   db + api + web
```

## Run it

### With Docker

```bash
docker compose up --build
```

Open http://localhost:8080. The API container applies migrations and seeds the demo school on first start.

### Locally

Requirements: Python 3.11+, Node 20+, PostgreSQL 15+.

```bash
cd apps/api
python -m venv .venv && .venv/Scripts/activate   # macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
cp ../../.env.example .env                         # edit ITHRAA_DATABASE_URL
alembic upgrade head
python -m app.seed.run
uvicorn app.main:app --reload --port 8000
```

```bash
npm install          # from the repo root
npm run dev:web      # http://localhost:5173, proxies /api to :8000
```

### Accounts

Every seeded account uses the password `ithraa123`.

| Role | Email |
| --- | --- |
| Student (Karim Haddad, 9-B) | `karim.haddad@ithraa.school` |
| Teacher (Ms. Rana Khoury, Cyber Awareness) | `rana.khoury@ithraa.school` |
| Admin (Ms. Hiba Nassar, program coordinator) | `hiba@ithraa.school` |

In demo mode the sign-in page has one-click role cards and the sidebar keeps the prototype’s
“Demo · view as” switch. Demo mode also freezes the clock at **Wed 21 Oct 2026, 6:30 PM** (week 6 of 28)
so the seeded year reads like the prototype. Turn it off with `ITHRAA_DEMO_MODE=false`.

## How the roles connect

Everything on screen is computed from shared records, so an action in one role shows up in the others.

| Action | Where it shows up |
| --- | --- |
| Admin edits the **weekly schedule** (slots, timing, custom weeks) | Lesson times on student and teacher screens, teacher load, “This week’s sessions”, program structure counts |
| Admin **publishes** a week | Notifications to every teacher and student; blocked while teacher-availability conflicts exist |
| Teacher plans and **publishes a session** (flow, skills, slides, materials, homework) | Student session page, readiness checklist, admin “Prepared” column, “Missing material” alerts |
| Teacher **sends a tip** | Student home “Tips from your teachers”; teacher readiness “Tip sent” |
| Student **submits homework** | Teacher “To grade” and gradebook; homework-on-time stats for teacher and admin |
| Teacher **grades** (optionally adds to portfolio) | Student feedback, notification, portfolio, knowledge-tree skills, teacher grading-time KPI |
| Student takes a **quiz** | Gradebook quiz average, skill mastery, flags, XP |
| Teacher marks **attendance** | Student heat map and attendance %, flags, admin alerts, teacher KPIs |
| Automatic **flags** (missed homework, absences, quiz drop) | Teacher “Need attention”, admin “Need attention” filter and profile |
| Teacher **note** / gradebook private note | Admin student profile “Flags & teacher notes” |
| Teacher **recommends** a student for a track | Student specialization match (20% teacher input) and “X of 4 recommendations” |
| Student **shortlists** a track | Admin overview “Grade 9 shortlists so far” |
| Candidate completes the **adaptive assessment** | Admin AI assessments (category, path, signals) and the nominee’s assessment score |
| Admin **accepts / waitlists** a nominee | Synced with the AI-assessment decision, seat quotas, family letters (EN/AR) |
| Teacher **automations** (deadline reminders, parent messages, slides for absentees, check-in codes) | Student notifications, parent message queue, student session check-in |

Key formulas live in `apps/api/app/services/`:

- Specialization match = 40% results + 40% interest survey + 20% teacher input (`specialization.py`)
- Nominee score = grades 30% + interest form 30% + adaptive assessment 40%, editable weights
- Flags: 2 missed homeworks in a row, 2 absent days, or quiz average below 60% (`metrics.py`)
- Teacher KPIs: sessions delivered, slides on time (last 6), grading turnaround, attendance, survey (`teachers.py`)

## Development

```bash
cd apps/api && pytest            # 44 cross-role integration tests; drops and reseeds ITHRAA_TEST_DATABASE_URL
                                 # (default postgresql+psycopg://ithraa:ithraa@localhost:5432/ithraa_test)
npm run typecheck                # from the repo root
alembic revision --autogenerate -m "describe change"   # after changing models
```

Uploaded files are stored under `ITHRAA_UPLOAD_DIR`. Parent messages are queued in `parent_messages`
for the school’s mail/SMS gateway; no gateway is wired in.
