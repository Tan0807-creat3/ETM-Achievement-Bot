# ETM Achievements

Ứng dụng và bot Discord cộng đồng theo dõi các thành tựu OwO mà ETM có thể nhận diện.

## Run & Operate

- Install dependencies with `pnpm install --frozen-lockfile`.
- Start the website with its managed workflow: `artifacts/etm-achievements: web`.
- Start the API and Discord bot with its managed workflow: `artifacts/api-server: API Server`.
- Run `pnpm run typecheck` to typecheck the workspace.
- Run `pnpm run build` to typecheck and build all packages.
- Run `pnpm --filter @workspace/db run push` only when applying reviewed schema changes to the development database.
- Replit provides `DATABASE_URL`; do not set it manually.
- Required secrets: `SESSION_SECRET`, `DISCORD_BOT_TOKEN`, and `DISCORD_CLIENT_SECRET`.
- `DISCORD_CLIENT_ID` is a non-secret Discord application ID. `DISCORD_REDIRECT_URI` is optional in development; the API uses the Replit development domain when available.
- Set `ETM_AUTO_TRACKING_ENABLED=true` and enable **Message Content Intent** in the Discord Developer Portal for automatic tracking.
- Invite the bot with permission to view/read configured channels and use application commands. A server administrator chooses one channel, all visible channels, or turns tracking off via `/set channel`, `/set all`, and `/set off`.

## Stack

- pnpm workspaces, Node.js 20, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Discord bot: discord.js 14
- Frontend: React, Vite, Wouter, TanStack Query
- API build: esbuild (ESM bundle)

## Where things live

- `artifacts/etm-achievements` — React website, achievement dashboard, Terms and Privacy pages.
- `artifacts/api-server` — Express API, Discord OAuth and bot.
- `artifacts/api-server/src/lib/etm-achievements.ts` — Discord achievement definitions.
- `artifacts/api-server/src/lib/etm-bot.ts` — command registration, tracking scope, OWO response recognition.
- `lib/db/src/schema` — Drizzle database schema.

## Architecture decisions

- Automatic progress is based on supported, recognized OwO command results in administrator-configured channels; ETM does not run OwO commands.
- Bot message text is inspected transiently for recognition. The database stores action metadata and source message IDs, not raw message text.
- Manual progress stays in local browser storage and is not merged with Discord-synced progress.
- Deleting synced progress removes activity records associated with the Discord user across ETM servers.

## Product

Users can connect Discord, view recognized activity and achievement progress, maintain a separate local manual log, and delete synced ETM activity. Server administrators configure the bot's monitoring scope.

## User preferences

- The user wants the website and legal pages updated, around 50 additional achievements, and automatic recognition of supported OwO activity.

## Gotchas

- Discord Gateway tracking will not work until the bot token is configured and Message Content Intent is enabled for the Discord application.
- Recognition covers supported command groups and success responses only; it cannot guarantee detection of every OwO activity.
- The website and API/bot are separate managed artifacts and need their own workflows.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
