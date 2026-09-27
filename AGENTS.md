<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Local Deals Hub agent instructions

This repository is a Next.js 16 app for a local marketplace with a storefront and a merchant portal. Keep changes aligned with the existing App Router conventions and the current Supabase-backed patterns.

## Quick commands

- Install dependencies: `npm install`
- Start the app locally: `npm run dev`
- Production build: `npm run build`
- Lint: `npm run lint`

## Project layout

- [app/page.tsx](app/page.tsx): storefront customer experience, deal filtering, favorites, and WhatsApp claim flow.
- [app/merchant/page.tsx](app/merchant/page.tsx): merchant authentication, deal management, QR redemption flow, and upload logic.
- [lib/supabase.ts](lib/supabase.ts): shared Supabase client configuration. The app expects `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variables.
- [app/layout.tsx](app/layout.tsx): root metadata and app shell.
- [tsconfig.json](tsconfig.json): TypeScript config with the `@/*` alias and strict mode.
- [README.md](README.md): generic Next.js baseline docs; prefer the code in this repo when there is a mismatch.

## Conventions to preserve

- Use the App Router in [app/](app/) rather than introducing a different routing pattern.
- Keep page-specific logic in the existing page files unless the code clearly belongs in a shared helper.
- Client-side pages use `'use client'`; follow that pattern where interactive behavior is required.
- Maintain the existing styling approach: utility classes via Tailwind and dark marketplace UI styling already present in [app/page.tsx](app/page.tsx).
- Favor minimal, targeted edits that match current patterns rather than rewriting the surrounding structure.
- When touching Supabase logic, keep the existing `supabase.from(...).select(...)`, `.insert(...)`, `.update(...)`, and storage upload conventions.
- For phone, pricing, and deal fields, preserve normalization patterns already used in the merchant portal.

## Configuration guidance

- This repo currently uses [next.config.ts](next.config.ts) and environment variables instead of a separate YAML config file.
- Do not add a new `config.yaml` or similar config file unless the task explicitly requires it and there is a strong repo-wide reason.
- Prefer existing Next.js and environment-variable conventions over adding custom config infra.

## Safety rules for AI coding agents

- Do not remove or edit the Next.js warning block above; it is intentionally present and should remain intact.
- Do not advance unrelated product work while finishing a requested bug fix or feature change.
- If a task is ambiguous, prefer the smallest fix that matches the current architecture and ask for clarification before broad refactors.
