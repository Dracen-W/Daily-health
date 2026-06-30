# Daily Health Database

Daily Health uses Prisma ORM with SQLite. The schema lives in `database/schema.prisma`, and the local SQLite file is created as `database/daily-health.db` when Prisma migrations run.

## Commands

```bash
npx prisma generate --schema database/schema.prisma
npx prisma migrate dev --schema database/schema.prisma
```

## Data Design

Important application data is stored in relational tables instead of browser-only storage. LocalStorage is only used for the anonymous browser profile ID and immediate UI preferences.

The database stores profiles, app settings, ingredient scans, cleaned Epicure pairing suggestions, recipes with translations and ordered child records, food logs, water entries, exercise records, sleep logs, weight logs, and daily history data.

Generated database files are ignored by Git:

```text
database/*.db
database/*.db-journal
database/*.db-wal
database/*.db-shm
```
