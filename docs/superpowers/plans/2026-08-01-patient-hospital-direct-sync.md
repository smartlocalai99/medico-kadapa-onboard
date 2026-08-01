# Patient Hospital Direct Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every hospital entered by a patient become an official shared hospital and appear automatically in `medisin_tablet_app`.

**Architecture:** A shared Supabase migration atomically copies patient custom hospitals into `public.hospitals`, deduplicated by a canonical name. The tablet app subscribes to `public.hospitals` Realtime changes and merges new or updated rows into its existing cached list.

**Tech Stack:** PostgreSQL/Supabase, Supabase Realtime, Next.js 16.2.10 Pages Router, React 19.2.4, Node test runner.

## Global Constraints

- Runtime UI changes belong only to `/Users/vardhanreddy/Desktop/medislash/medisin_tablet_app`.
- The shared database migration belongs in the DrJiva repository that owns `patient_custom_hospitals`; it does not change patient UI or require a native rebuild.
- Existing official hospital code, address, phone, logo, doctor name, and doctor image must not be overwritten.
- Preserve unrelated worktree changes.

---

### Task 1: Testable Hospital Cache Merge

**Files:**
- Create: `utils/hospitalDirectory.mjs`
- Create: `tests/hospitalDirectory.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `upsertHospital(hospitals, incoming)` returning a name-sorted list with one row per hospital ID.

- [ ] Write a failing Node test showing a new hospital is inserted, an updated hospital replaces its old row, and the result stays name-sorted.
- [ ] Run `node --test tests/hospitalDirectory.test.mjs` and confirm RED because the helper does not exist.
- [ ] Implement the minimal pure helper.
- [ ] Add `"test": "node --test tests/**/*.test.mjs"` to `package.json`.
- [ ] Run `npm test` and confirm GREEN.
- [ ] Commit only the helper, test, and script.

### Task 2: Tablet App Realtime Hospital Refresh

**Files:**
- Modify: `pages/index.js`
- Test: `tests/hospitalDirectory.test.mjs`

**Interfaces:**
- Consumes: `upsertHospital(hospitals, incoming)`.
- Produces: a `supabase_realtime` subscription to every change on `public.hospitals`, with channel cleanup on unmount.

- [ ] Read the installed Next.js 16 Pages Router client-side data and `useEffect` guidance under `node_modules/next/dist/docs/`.
- [ ] Import `upsertHospital` and add an effect subscribing to `{ event: '*', schema: 'public', table: 'hospitals' }`.
- [ ] On INSERT or UPDATE, merge `payload.new`; on DELETE, remove `payload.old.id` and clear the selected hospital if it was deleted.
- [ ] Remove the Supabase channel in the effect cleanup.
- [ ] Run `npm test`, `npm run lint`, and `npm run build`.
- [ ] Commit only the tablet runtime integration.

### Task 3: Atomic Shared Database Sync

**Files:**
- Create through `npx supabase migration new sync_patient_hospitals`: `/Users/vardhanreddy/Desktop/DRJIVA/drjiva-app/supabase/migrations/*_sync_patient_hospitals.sql`

**Interfaces:**
- Consumes: `public.patient_custom_hospitals(name)`.
- Produces: canonical uniqueness for `public.hospitals`, a backfill, an atomic `SECURITY INVOKER` trigger, and Realtime publication membership.

- [ ] Generate the migration with the Supabase CLI; do not invent its filename.
- [ ] Add an immutable canonical-name function and stored generated `hospitals.normalized_name` column.
- [ ] Add a unique index after verifying production has no canonical collisions.
- [ ] Backfill distinct existing patient hospital names using `ON CONFLICT (normalized_name) DO NOTHING`.
- [ ] Add an `AFTER INSERT OR UPDATE OF name` trigger on `patient_custom_hospitals` that inserts the name into `hospitals` without overwriting official fields.
- [ ] Add `public.hospitals` to `supabase_realtime` only when not already published.
- [ ] Run the available Supabase database checks/advisors, deploy the pending migration, and verify official normalized names are unique.
- [ ] Commit only the migration.

### Task 4: Production Release and Verification

**Files:**
- No additional source files expected.

**Interfaces:**
- Consumes: the deployed database trigger and tablet Realtime listener.
- Produces: a production Vercel deployment of `medisin_tablet_app`.

- [ ] Run `npm test`, `npm run lint`, `npm run build`, and `git diff --check` in `medisin_tablet_app`.
- [ ] Deploy the existing linked Vercel project to production without changing environment variables.
- [ ] Open the production app and confirm hospitals load.
- [ ] Add a hospital through the patient flow and confirm it becomes an official row and appears in the open tablet app without manual reload.
- [ ] Report the deployment URL, migration name, verification results, and that no Android/iOS rebuild is required.
