# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Trademark/brand monitoring platform migrated from PHP Laravel to Node.js/React.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Auth**: Custom JWT with bcryptjs
- **Build**: esbuild (CJS bundle)

## Architecture

### Backend (artifacts/api-server)
- Express 5 REST API at /api/*
- JWT authentication with role-based access (admin/user)
- `rawQuery` helper in `lib/db/src/index.ts` for Drizzle ORM QueryResult handling
- Routes: auth, dashboard, users, monitoring, alerts, domains, logo, social, products, organizations, settings, search (proprietor/assessment/opposition/license)
- Search routes proxy to external trademark APIs (193.30.120.239, api.maxfabulous.com, 23.148.145.241, citations.rasr.in)
- Assessment mode API (api.maxfabulous.com:8080) is IP-restricted; fallback uses search_assessment.php with server-side mode filtering (startswith/contains)
- Opposition API (23.148.145.241) and Proprietor API (193.30.120.239/madrid2.php) may require IP whitelisting on external servers
- Assessment API returns data in `compare.references` object (not `data[]` array); `companyName` field mapped to `buisnessName`
- Assessment has TWO distinct result modes matching PHP:
  - **Mode search** (startswith/contains): Returns `{ searchMode: true, data: [...], filters }` — flat table with columns Logo/Appno/Date Of App/Status/State/Country/Tm Name/Date/Expire At/Company/Address/Owner/Company Type/Description
  - **Non-mode search** (phonetic — sent as no searchMode): Returns `{ searchMode: false, riskGroups: { vhigh, high, medium, low, other }, stats, sectionStatuses }` — accordion with risk-level sections, charts (gauges, pie, bar, line), table columns: checkbox/Number/TM/Status/State/Company/Type/Class/Expiry/User Detail/Date/Goods And Serice
- Risk categorization uses simplified levenshtein-based scoring (similarity > 80 → vhigh, 70-80 → high, 60-70 → medium, 45-60 → low, <45 → other; removed/withdrawn → low)
- Assessment & Proprietor backends compute full stats: dropOutRate, renewalRate, classWise, yearWise, exactYears, variationYears, filter arrays
- Opposition backend computes stats: yearWise, agents (sorted by count), filterOppAgentName, filterOppName
- Image URLs use cdn.tmpilot.com CDN
- Cron job scheduler using node-cron (initialized on server startup)

### Cron Jobs (artifacts/api-server/src/cron/)
All PHP Laravel scheduled tasks are ported to Node.js using node-cron:
- `monitoring:process:scope` — every minute (with overlap protection), processes monitoring scopes via GraphQL API
- `monitoring:process:scope:india` — every minute (with overlap protection), processes India-specific monitoring via separate API
- `monitoring:rerun:stucked` — every 10 minutes, resets stuck monitoring scopes older than 20 min
- `monitoring:check:latest` — every 3 hours, checks for new journal dates from GraphQL API
- `domain:monitoring:clean` — daily, resets domain monitoring statuses to 0
- `domain:monitoring:check` — daily 10:00, runs domain WHOIS monitoring checker (89.40.6.177 API)
- `alerts:check` — 7 types (FSSAI/MCA/UDYAAM/Citations/OppositionWatch/ProprietorSearch/DomainMonitoring) staggered 10:20–12:20
- `alert:report` — daily 14:00, generates alert report per user
- `scale-serp:clean` — daily, cleans temp images
- `scale-serp:run` — daily 09:10, runs ScaleSerp social watch search
- `export:queue:process` — every 10 minutes, processes export queue items
- `logo:search` — daily 02:00, checks for similar logos

### Database Schema Tables
- users, clients, monitoring_keywords, monitoring_results, monitoring_scopes, monitoring_latest
- alerts (with freq, next_check_date), alert_results (with name, address, record_id), alert_changes
- domain_monitoring (with status), domain_results (with domain_name, registrant_name, registrant_country, create_date)
- social_keywords (with mode, trigger_at), social_results (with page_url)
- logo_searches, logo_results, export_queue, products, organizations, settings

### Frontend (artifacts/monitoring)
- React + Vite SPA
- Top navigation bar with dropdown menus (matching PHP original exactly)
- Brand: "TMPilot WTW" with Eye icon
- Layout: horizontal top nav, user profile dropdown (right)
- All routes use `ProtectedRoute` wrapper; admin routes have `adminOnly` flag

### Pages & URL Structure (matches PHP Laravel exactly)
- `/` - Dashboard (Home)
- `/alerts`, `/alerts/list`, `/alerts/results` - Alert management
- `/assessment` - New Trademark search
- `/license` - License search
- `/search_opposition` - Oppositions search (note: underscore, matches PHP)
- `/proprietor` - Proprietor search
- `/search` - B2B/B2C search
- `/social-watch/list`, `/social-watch/results` - Social watch
- `/domain-monitoring`, `/domain-monitoring/results` - Domain monitoring
- `/tm-watch/add`, `/tm-watch/import`, `/tm-watch/import-failed`, `/tm-watch/list`, `/tm-watch/view`, `/tm-watch/export` - TM Watch
- `/logo`, `/logo/add`, `/logo/results` - Logo search
- `/image-watch`, `/image-watch/import` - Image watch
- `/files` - File management
- `/user/contacts` - Client contacts
- `/user/profile` - User profile
- `/billing/invoices` - Billing invoices
- `/organization` - User's organization

### Admin Pages (admin role required, PHP-matching URLs)
- `/user/list`, `/user/list/:id` - User management
- `/settings` - Admin settings
- `/settings/roles` - Roles & permissions
- `/settings/pdf` - PDF export settings
- `/settings/email` - Email settings
- `/keyword-logs` - Keyword logs
- `/query-logs` - Query logs
- `/user_stats` - User statistics (note: underscore, matches PHP)
- `/templates` - Action templates
- `/tm-watch/settings` - TM Watch settings
- `/reporting/logs` - Communication/reporting logs
- `/organizations` - Organizations list
- `/products/list` - Products list
- `/coupon/list` - Coupon list

### Navigation Menu Structure (top nav bar)
Home | Alerts(Add/List/Results) | Search(New Trademark/License/Oppositions/Proprietor/B2B-B2C) | Social Watch(List-Add/Results) | Domain Monitoring(List-Add/Results) | TM Watch(Add New/Import/Import Failed/My Keywords/View Results/Export Results) | Logo Search(View/Add/Results) | Files | Contacts | Admin→(Organizations/Products/Coupon List/PDF Settings/Email Settings/Users/Settings/Keyword Logs/Query Logs/User Stats/Action & Templates/Roles & Permissions/Monitoring Settings/Communication Logs)

### PHP Parity Notes
- Assessment table columns: checkbox, Logo, Appno, Tm Name, Status, State, Company, Company Type, Class, Expire At, Date, Date Of App, Description (Logo shows trademark image from cdn.tmpilot.com)
- Social watch site dropdown: grouped by B2B (IndiaMart, TradeIndia), B2C (Flipkart, Amazon.in), Search Engines (Google, YouTube, Bing); frequency dropdown: 30/60/90/180/360 days
- Domain monitoring search types: starts/contains/ends (API enum values)
- Billing invoices has Actions column with Pay button for unpaid invoices
- Organizations table: #, Name, Head Name, Head Email, Members, Created
- License page has per-source tables: FSSAI (Name/Company/Address/License No./Category/Status), MCA (CIN/Name/Date/State/Address/Roc/Description/Created/Updated), Udyaam (Name/Unit/Address/State/District/Pin), Citations (ID/URL/Brand/Manufacturer) + XLS Export/PDF Export buttons
- Upload pages (TM Watch Import, Logo Add, Image Watch Import) all use red "Submit" button matching PHP
- Logo Add includes "- Select Client -" dropdown and "Add Logo(s) Here" heading
- Image Watch Import shows "Applications file (.XLSX) / Images File (.TXT)" description
- TM Watch Settings page title is "Monitoring Settings" (matching PHP blade template)

### Seed Credentials
- Admin: admin@monitoring.com / admin123
- User: john@lawfirm.com / admin123

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
