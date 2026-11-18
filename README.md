# Sweety - Blood Glucose Tracker

A small web app where a diabetes patient records up to 4 blood glucose readings a day and views daily and monthly reports.

- **API:** Node.js + Express + PostgreSQL
- **Frontend:** React (Vite)
- **Auth:** email + password, passwords hashed with bcrypt, JWT sessions
- Built as the take-home assignment for the Junior Full Stack Developer - JavaScript & AI role at Kenpath.

## Live demo

**https://sweety-os5f.onrender.com**

- Demo login: `demo@sweety.app` / `demo1234` (seeded with ~60 days of sample readings)
- Hosted on Render's free tier: the app sleeps when idle, so the first visit can take up to a minute to wake up. After that it is fast.
- The free PostgreSQL database runs until 19 December 2026.

## Features

**Required**

- Sign up and log in. Passwords are stored as bcrypt hashes, never plain text. After login, each user only ever sees their own readings (every query is scoped by the authenticated user's id).
- Add, view, edit and delete readings. Each reading has a date, one of the 4 time slots (Morning (fasting), After breakfast, After lunch, After dinner) and a value in mg/dl.
- Validation, with clear error messages shown in the UI:
  - Value is required - "Please enter a glucose value."
  - Whole number between 40 and 600 - "Value must be between 40 and 600 mg/dl."
  - One reading per slot per day - "You already have an After lunch reading for this date."
  - Maximum 4 readings per day - "You can add only 4 readings per day."
  - No future dates - "Date cannot be in the future."
- Reports for a selected date, each showing the highest, lowest and average reading (rounded to 1 decimal) and the number of readings, with a friendly empty state when there is no data:
  - **Daily** - the selected date, plus a table listing each reading with its slot
  - **Month-to-date** - 1st of the month to the selected date
  - **Monthly** - the whole previous month
- Tests: 34 API tests (Jest + Supertest) covering auth, every validation rule, per-user data isolation and the report boundaries and rounding.

**Bonus (picked 4)**

- Pagination on `GET /api/readings` (`?page=1&limit=20`)
- Line chart of the daily average glucose over the month (Recharts), with 90/140 mg/dl reference lines
- `docker-compose.yml` that starts PostgreSQL and the app together
- Frontend tests with React Testing Library for the reading form (8 tests)

## Project layout

```
sweety/
  server/          Express API, migrations, seed, Jest tests
    src/
      index.js     entry point
      app.js       express app (serves the built client too)
      db.js        pg pool (DATE columns returned as YYYY-MM-DD strings)
      migrate.js   schema (users, readings, unique per user+date+slot)
      seed.js      demo user + 60 days of sample readings
      validation.js  slots, limits and the exact error messages
      routes/      auth, readings, reports
    tests/         auth.test.js, readings.test.js, reports.test.js
  client/          React app (Vite)
    src/pages/     Login, Register, Dashboard (readings), Reports
    src/components/ ReadingForm, ReportCard, GlucoseChart
    tests/         ReadingForm.test.jsx
  screenshots/     the app working
  docker-compose.yml, Dockerfile
```

## Prerequisites

- Node.js 18+ (built and tested on Node 22)
- PostgreSQL 14+ running locally (built and tested on PostgreSQL 16), or Docker

## Setup

1. **Install dependencies**

   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

2. **Create the database and user**

   ```bash
   sudo -u postgres psql -c "CREATE USER sweety WITH PASSWORD 'sweety_dev_pw';"
   sudo -u postgres psql -c "CREATE DATABASE sweety OWNER sweety;"
   sudo -u postgres psql -c "CREATE DATABASE sweety_test OWNER sweety;"   # for the tests
   ```

3. **Configure environment**

   ```bash
   cp .env.example server/.env
   # edit server/.env if your database credentials differ
   ```

   See `.env.example` for every variable. No real secrets belong in `.env.example`.

4. **Create the tables and load the demo data**

   ```bash
   cd server
   npm run migrate
   npm run seed
   ```

   The seed creates the demo user `demo@sweety.app` / `demo1234` with about 60 days of sample readings.

## Run

**Server (API on http://localhost:4000)**

```bash
cd server
npm run dev        # or: npm start
```

**Client (dev server on http://localhost:5173, proxies /api to the server)**

```bash
cd client
npm run dev
```

**Single-server mode:** build the client once (`cd client && npm run build`) and open http://localhost:4000 - the Express server serves the built React app together with the API.

## Tests

```bash
cd server && npm test     # 34 API tests (uses the sweety_test database)
cd client && npm test     # 8 frontend tests for the reading form
```

The server tests run against a separate `sweety_test` database (`NODE_ENV=test` switches `DATABASE_URL` to `TEST_DATABASE_URL`) and truncate it between test files, so they never touch real data.

## Docker (optional)

```bash
docker compose up --build
```

This starts PostgreSQL and the app, runs the migration and seed, and serves everything on http://localhost:4000 (demo user `demo@sweety.app` / `demo1234`).

## API overview

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | sign up with name, email, password |
| POST | `/api/auth/login` | log in, returns a JWT |
| GET | `/api/auth/me` | current user |
| GET | `/api/readings` | list own readings; filters `date`, `from`, `to`; `page`, `limit` |
| POST | `/api/readings` | add a reading |
| PUT | `/api/readings/:id` | edit a reading |
| DELETE | `/api/readings/:id` | delete a reading |
| GET | `/api/reports/daily?date=` | daily report + the day's readings |
| GET | `/api/reports/month-to-date?date=` | 1st of month to selected date |
| GET | `/api/reports/previous-month?date=` | whole previous month |
| GET | `/api/reports/series?month=` | per-day averages for the chart |

All routes except register/login require `Authorization: Bearer <token>`.

## Screenshots

See the [`screenshots/`](screenshots/) folder:

1. [Login](screenshots/01-login.png)
2. [Dashboard - one day with all 4 slots filled](screenshots/02-dashboard.png)
3. [Adding a reading](screenshots/03-add-reading.png)
4. [Validation error shown in the UI](screenshots/04-validation.png)
5. [Reports - daily, month-to-date and previous month](screenshots/05-reports.png)
6. [Month chart](screenshots/06-chart.png)

## Notes

**Assumptions I made**

- The 4 slots are fixed and labelled exactly as in the assignment: Morning (fasting), After breakfast, After lunch, After dinner. A reading does not need its own clock time, the slot is the time of day.
- "Maximum 4 readings per day" follows automatically from one-reading-per-slot with 4 slots; the API still enforces it explicitly so that rule has its own error message and test.
- "Date cannot be in the future" is checked against the server's local calendar date, and the date picker in the UI also blocks future dates.
- Session stays in a JWT (7 day expiry) stored in localStorage; logging out clears it. Good enough for a small assignment app.
- The demo seed user is a single patient account; registration of new accounts stays open as in a normal app.

**What I would improve with more time**

- Email verification and a proper "forgot password" flow.
- Refresh tokens and httpOnly cookies instead of a localStorage JWT.
- mmol/L unit support (many glucometers outside India/US use it).
- Target-range settings per user and colour coding in-range vs out-of-range values.
- Export reports to PDF/CSV for doctor visits, then the doctor role from the bonus list.
