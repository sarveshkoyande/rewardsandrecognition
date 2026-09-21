# Rewards & Recognition Tracker — Ideation

Date: 2026-09-21

## What's grounding this

`extracted/src/App.tsx` (772 lines) is a Figma Make single-file React+Vite+Tailwind prototype. It already proves the core loop end-to-end with in-memory state and a fake "viewing as" user switcher:

- **Admin → Overview**: KPI tiles (total credits, used, awards given), a manager credit-utilisation table with credit "pips," an awards-given table for the current cycle, and a collapsible history of past cycles.
- **Admin → People & Structure**: add/remove managers and reportees, edit or auto-reset each manager's credit allocation (auto = 40% of headcount).
- **Manager view**: a credit balance card, an award form (recipient, category, free-text reason — one award per reportee per cycle, blocked at 0 credits), and their own current + historical awards.
- No backend, no auth, no persistence — state resets on refresh, and role is chosen from a dropdown rather than logged into.

This scopes the ideation tightly: the prototype is the UI proof of concept; the real work is what a shared, multi-user, org-real version needs around it. `C:\Users\Admin\Desktop\omnios` was checked as the referenced design system — it's a separate Next.js/Python agent product with its own `app/globals.css` and component conventions, usable as a visual/token reference but not a component library to import directly (different framework, different stack).

The three "budget-item" asks from the request are already covered by the prototype's shape and are treated as fixed scope, not ideation targets: (1) manager can see credits assigned vs. awarded, (2) admin has org-wide visibility of who awarded whom, (3) admin does the one-time managers/reportees setup. What follows are the ideas for everything the request flags as still open: real login, persistence, and "what else should this have."

## Ideas generated (18)

1. **Firebase Auth + Firestore backend swap-in** — replace the fake user dropdown and in-memory arrays with Firebase Auth (email link or Google SSO) and Firestore collections for managers, reportees, awards, and cycles, on the free Spark plan.
2. **Role claims via Firebase custom claims** — store `role: admin | manager` as a custom claim set by a callable Cloud Function, not a Firestore field, so client-side role checks can't be spoofed by editing a document.
3. **Cycle lifecycle as a first-class entity** — turn `CURRENT_CYCLE` from a hardcoded constant into a Firestore doc admins open/close, so "Sep 2026" isn't baked into the bundle.
4. **Audit log collection** — every credit edit and award write append-only logged with actor, timestamp, before/after, separate from the awards table itself, for the admin's "who gave what" visibility to survive disputes.
5. **CSV/export of the admin dashboard** — let admins pull a cycle's award table and credit-utilisation table out for HR or leadership reporting.
6. **Email notification on award given** — Cloud Function trigger that emails the recipient (and optionally their skip-level) when a manager submits an award, since "rewarding is not happening on this platform" but the *record* of it should reach people.
7. **CSV bulk-import for the one-time manager/reportee setup** — admin uploads a roster instead of clicking "+ Add reportee" one row at a time, since org setup is explicitly a bulk one-time job.
8. **Org-chart-aware auto-credit rule editor** — let the admin change the "40% of headcount" formula (or override per-manager) from the UI instead of it being a hardcoded function.
9. **Manager delegate / backup approver** — a manager on leave can nominate a peer to log awards on their behalf for the cycle, credits still debited from the original manager.
10. **Point-in-time credit snapshots per cycle** — persist each cycle's *allocated* total (not just current), so re-running `calcDefaultCredits` after headcount changes doesn't rewrite history.
11. **Recipient-side view** — a lightweight read-only page for the reportee to see awards they've personally received, across cycles (currently only admins and their manager can see this).
12. **Skip-level / grandparent visibility** — an admin role tier or "view as my org" filter for a senior manager who wants to see just their sub-tree, not the whole company.
13. **SSO restriction by domain** — Firebase Auth restricted to the org's email domain via a Cloud Function-checked allow-list, so `login for admins and all` doesn't require inviting each user manually.
14. **Category analytics view** — a simple bar/breakdown of award categories over time (e.g., "Innovation" vs "Team Player" counts) for the admin dashboard, using data already captured but not yet visualized.
15. **"Credits expire at cycle close" reconciliation report** — admin-facing summary of unused credits per manager when a cycle closes, since unspent credits currently just silently roll into a fresh `remaining` calculation next cycle.
16. **Mobile-responsive manager award form** — the prototype's `max-w-5xl`/table-heavy layout is desktop-only; managers giving quick recognition from a phone is a realistic use case for a lightweight internal tool.
17. **Offline-tolerant award submission (optimistic write + retry queue)** — Firestore's offline persistence used deliberately so a manager on spotty wifi doesn't lose a half-typed award.
18. **Self-serve admin invite flow** — admin adds a manager's email in People & Structure, which triggers a Cloud Function to create/invite the Firebase Auth account, so account creation isn't a separate manual IT step.

## Critique

| # | Idea | Verdict | Why |
|---|---|---|---|
| 1 | Firebase Auth + Firestore swap-in | **Keep** | Directly answers the explicit ask ("Firebase-based setup for login, preferably free to use") and is the load-bearing architectural decision everything else depends on. |
| 2 | Custom claims for role | **Keep** | Cheap to add now, expensive to retrofit; prevents a real security hole (client-editable role field) in a tool that gates who can allocate credits. |
| 3 | Cycle lifecycle as an entity | **Keep** | The prototype's hardcoded `CURRENT_CYCLE` string is the single biggest thing that breaks the moment this ships past one month. |
| 4 | Audit log collection | **Keep** | The stated admin requirement is literally "who has given to whom" — an immutable log is more trustworthy than deriving it from a mutable awards table. |
| 5 | CSV export | **Keep** | Low effort, and reporting-out-of-the-tool is the natural next question leadership asks once the dashboard exists. |
| 6 | Email on award given | **Reject** | User explicitly said the platform doesn't do the rewarding, only the record-keeping — an email notification implies the platform is *announcing* the award, which oversteps the stated scope. Worth revisiting only if the user asks for recipient-facing comms later. |
| 7 | CSV bulk-import for setup | **Keep** | Matches "that's the one-time job" language — a one-time bulk job deserves a bulk-import UI, not 20 individual "+ Add reportee" clicks. |
| 8 | Configurable auto-credit formula | **Reject (for now)** | No signal the 40% rule needs to change — it's already parameterized in code (`calcDefaultCredits`); exposing it as admin-editable UI is speculative complexity ahead of a real request. |
| 9 | Manager delegate/backup approver | **Reject** | Not mentioned anywhere in the ask, and "manager on leave" is an edge case that adds an approval-delegation model to what's meant to stay "nothing more, nothing less." |
| 10 | Point-in-time credit snapshots | **Keep** | Direct consequence of making cycles real (#3) — without this, editing a manager's headcount retroactively corrupts past cycles' reported totals. |
| 11 | Recipient-side view | **Reject** | Explicitly out of scope — the ask names only "manager" and "admin" as roles with logins; reportees were never described as needing an account. |
| 12 | Skip-level visibility tier | **Reject (for now)** | Only two roles were described (admin, manager); a third permission tier is unrequested scope creep. Flag if the org turns out to have >1 admin layer. |
| 13 | Domain-restricted SSO | **Keep** | Needed the moment Firebase Auth exists — otherwise anyone with an email can sign up, and "define who the managers are" (admin's one-time job) needs to mean something at the auth layer too. |
| 14 | Category analytics | **Reject (for now)** | Nice-to-have on top of data the schema already has, but adds dashboard surface area beyond "who awarded what, when" — better as a fast follow than day-one scope. |
| 15 | Credit-expiry reconciliation report | **Reject (for now)** | Assumes a business rule (credits expire, don't roll over) that was never stated. Ask before building — could go either way. |
| 16 | Mobile-responsive award form | **Keep** | A manager logging one award from their phone between meetings is a realistic, low-cost-to-support use case, and the existing layout is desktop-only by construction. |
17 | Offline-tolerant submission | **Reject (for now)** | Real engineering value but speculative reliability work for a low-stakes, low-frequency write (a handful of awards per manager per month) — premature for a first build. |
| 18 | Self-serve admin invite flow | **Keep** | Removes the friction point between "admin defines the manager list" (stated requirement) and "managers can log in" (also stated) — without it, IT becomes a manual bottleneck for every new manager. |

## Survivors, explained

**Foundation (do these first — everything else depends on them):**
- **Firebase Auth + Firestore backend** (#1) with **custom-claim roles** (#2) and **domain-restricted sign-in** (#13): this is the actual "login for admins and all" ask, built so role can't be spoofed and only org accounts can join. Firebase's free Spark tier comfortably covers a tool at this scale (a handful of admins, a few dozen managers, monthly award volume in the tens).
- **Cycle as a real entity** (#3) plus **snapshotted allocations** (#10): turns the demo's hardcoded "Sep 2026" into something that survives past one month and keeps historical reporting accurate even as headcount changes.

**High-value, low-friction additions:**
- **Audit log** (#4): gives the admin's "who awarded whom, when" requirement a tamper-evident source of truth, separate from the editable award records.
- **CSV bulk-import for setup** (#7) and **self-serve admin invite** (#18): both target the admin's explicitly-named "one-time job" — importing the roster and getting managers logged in — so that job takes an afternoon, not a week of manual clicks.
- **CSV export of the dashboard** (#5): closes the loop for whoever consumes this data outside the tool (HR, leadership decks).
- **Mobile-responsive award form** (#16): matches how a manager actually gives a quick award in practice.

**Explicitly rejected, with reasons an editor can revisit:**
- Email notifications, recipient-facing views, and delegate/approver flows all imply the platform does more than "record what already happened elsewhere" — reject unless the user says otherwise.
- Configurable credit formulas, skip-level admin tiers, category analytics, and expiry reconciliation are plausible v2 features but have no grounding in the stated requirements — they'd be premature scope.

## Cost note

This ideation pass read the shipped prototype in full and cross-checked the referenced `omnios` folder; no code was written or changed. Turning any survivor into a build requires `ce-brainstorm` (to firm up requirements — Firebase project setup, exact roster-import format, what "admin" org-visibility should default to) before `ce-plan`.

## Next steps

- Run `ce-brainstorm` on the foundation bundle (Firebase Auth/Firestore + cycles + roles) to turn it into a requirements doc.
- Or pick a narrower slice (e.g., just "swap fake login for real Firebase Auth") to brainstorm first and ship incrementally.
- Or say "surprise me" / ask for a different angle if none of these land.
