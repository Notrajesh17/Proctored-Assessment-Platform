# Proctored assessment platform

Small full-stack app for an SDE-II take-home. Admins put together a paper, assign it, and look at scores + a crude proctoring timeline. Candidates sit the paper in the browser. Timer and scoring live on the server so a refresh doesn't buy extra time.

Stack: NestJS + MongoDB + React (Vite). JWT auth, two roles.

## Local setup (the way I actually ran it)

You need Node 20+, Docker (for Mongo only is fine), and npm.

### 1. Mongo

```bash
docker compose up -d mongo
```

Or any local Mongo on `27017`.

### 2. Backend

```bash
cd backend
cp .env.example .env   # already has sensible defaults
npm install
npm run start:dev
```

API: http://localhost:3000/api  
Swagger: http://localhost:3000/api/docs

If `SEED_ON_START=true` and the users collection is empty, seed data is inserted on boot.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

UI: http://localhost:5173  
Vite proxies `/api` to the Nest server.

### All-in-one Docker

```bash
docker compose up --build
```

UI on http://localhost:8080, API on http://localhost:3000.

## Env vars (backend)

| Name | What it does |
| --- | --- |
| `PORT` | default 3000 |
| `MONGODB_URI` | e.g. `mongodb://localhost:27017/proctor_assess` |
| `JWT_SECRET` | anything long-ish for local |
| `JWT_EXPIRES_IN` | e.g. `8h` |
| `SEED_ON_START` | `true` to seed an empty DB |

## Seeded logins

Password for all three: `Password1!`

- `admin@assess.local` — admin (Priya)
- `ravi@assess.local` — candidate, already assigned the sample paper
- `anika@assess.local` — same

There's a published 15-min JS screening paper with 3 objective questions + 1 short answer. Negative marking is on (1 mark). Auto-submit after 5 counted violations.

## What works

**Admin**
- create / edit / publish papers
- add single-choice, multi-choice, short-answer questions
- duration, negative marking, violation cap
- assign to candidates (duplicates skipped)
- submissions list + answer review + event timeline

**Candidate**
- see assigned papers
- start / resume after refresh
- autosave (~1.2s debounce)
- server timer; auto-submit when it hits 0
- cannot submit twice
- cannot open someone else's attempt (403)

**Proctoring (browser-level, not a lock-down client)**
- tab switch, window blur, leaving fullscreen, copy, paste, right-click
- right-click is logged but does not increment the violation count (too easy to fat-finger)
- copy/paste are blocked in the exam page and logged

Scoring: exact match on MCQ. Short answers are stored, not graded. Total shown is objective only. Negative marking cannot pull the score below 0.

## Tests

```bash
cd backend
npm test
```

Covers scoring + remaining-time helper. That's the bit I didn't want to get wrong.

## API docs

Swagger at `/api/docs`. Login, copy the token, Authorize, then hit the rest.

Main routes:

- `POST /api/auth/login`
- `POST /api/auth/register` (always creates a candidate)
- `GET /api/users` (admin)
- `POST /api/assessments` …
- `POST /api/assessments/:id/questions`
- `POST /api/assessments/:id/assign`
- `GET /api/me/assignments`
- `POST /api/assignments/:id/start`
- `PATCH /api/attempts/:id/answers`
- `POST /api/attempts/:id/submit`
- `POST /api/attempts/:id/events`
- `GET /api/attempts/:id/events`

## Assumptions / things I didn't do

- No camera or screen share. "Proctoring" here is event logging + a violation cap.
- One attempt per assignment. No retakes.
- Short answers are not auto-graded and there's no admin "mark this 2/3" UI.
- Clock is the API server's clock. Client countdown is cosmetic and resyncs every 20s.
- JWT in localStorage. Fine for a take-home, not what I'd ship for a bank.
- Register is open for candidates; admins only come from seed or a direct DB insert. Didn't build an invite flow.
- No pagination. Fine until you have more than a classroom of rows.
- Deployment wasn't required; I didn't put this on a public host.
