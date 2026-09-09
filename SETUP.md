# HellCraft CRM — Setup

## Prerequisites
- Node.js 18+
- MongoDB (Atlas or local)

## Quick Start

1. **Clone / copy** this directory

2. **Install dependencies** (already done if you're reading this in the repo)
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local`:
   - `DATABASE_URL` — your MongoDB connection string
   - `AUTH_SECRET` — run `openssl rand -base64 32` to generate

4. **Push schema to MongoDB**
   ```bash
   npx prisma db push
   ```

5. **Seed with sample data**
   ```bash
   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
   ```

6. **Run dev server**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

## Default Login Credentials (after seeding)

| Role     | Email                   | Password     |
|----------|-------------------------|--------------|
| Admin    | it@hellcraft.in         | admin123     |
| Founder  | arjun@hellcraft.in      | founder123   |
| Founder  | priya@hellcraft.in      | founder123   |
| Employee | rohan@hellcraft.in      | emp123       |

## Features
- Dashboard with today's meetings, tasks, follow-ups
- CRM: Contacts (table), Branches (cards), Leads (Kanban + table)
- Calendar (day/week/month/agenda views, founder calendar)
- Tasks (with views: today, overdue, mine, upcoming, completed)
- Activity timeline
- Global search (Cmd+K)
- Settings: users, branches, profile
- Role-based access (Admin / Founder / Employee)

## Tech Stack
Next.js 16 · TypeScript · Tailwind CSS v4 · Prisma ORM v5 · MongoDB · NextAuth v5
