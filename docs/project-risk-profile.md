<!-- v1.0.0 -->
# Project risk data and local testing

Pair this backend branch with frontend `Akshay_improve_project_risk_profile` (PR #5747).

## Demo data

Configure the backend's usual `.env` for a **development** database. Run from HGNRest:

```sh
node src/scripts/seedProjectRisk.js --confirm-database YOUR_DEVELOPMENT_DB_NAME
npm run dev
```

The confirmation must match `.env`'s `dbName`; production mode/database names are rejected. Seeding is opt-in, never run at server startup. It creates five `[Risk Demo]` projects with 181 days of synthetic daily observations (905 total), covering Low, Medium, High, completed-under-budget and missing-cost cases. Re-running refreshes only these deterministic demo records; ordinary project data is untouched. Demo issue records also appear in other issue-based dashboards, so use development data only.

In the frontend, run `npm run start:local`, log in normally, and open `/dashboard/project-risk-profile`:

1. Clear selection, then select the five `[Risk Demo]` projects. Expect two Low, one Medium, one High and one Unknown with current data.
2. Switch cost/time delay. High and Medium have nonzero delays; the completed project stays at zero. Cost labels show savings on under-budget projects.
3. Select only High risk, then Last 7/30/90 days. The trend's observation range changes, and comparisons use the preceding equal-length period. The latest-value bars can remain the same when periods share the same end date.
4. Choose a historical custom date range: the chart/table must use the last recorded observation within that range. Current snapshot must restore live values. Current snapshot compares against yesterday.
5. Try clearing/restoring projects, risk/name sorting, keyboard controls, dark/light themes and phone width.

## Source and calculation contract

`GET /api/projects/risk-profile` remains authenticated through the app's JWT middleware. It returns stable `_id` and `projectId`, current metrics, `asOf`, lifecycle status and up to 365 days of saved `history`. GET never creates observations. Existing `projects`, `dates`, and issue-createdAt `startDate`/`endDate` query behavior is retained. History always contains complete daily observations, independent of issue-createdAt filters.

Risk profiles currently reference the **Issue document's `_id`**, not a BuildingProject ID. This existing relationship is preserved.

For Administrator/Owner callers, `POST /api/projects/risk-profile` creates a profile and `PATCH /api/projects/risk-profile/:projectId` updates it. Accepted inputs: startDate, endDate, positive initialCostEstimate, optional nonnegative currentCostIncurred, issues, positive plannedTime (days), nonnegative actualTimeElapsed (days), status (`active`, `completed`, `unknown`), and completedAt. Create also requires projectId. Client history is ignored. Invalid schedules, amounts or completion dates return 400. Completed profiles require completedAt; omit/null actualTimeElapsed for active projects whose elapsed days should be calculated automatically.

- Cost forecast = spend / min(elapsed days / planned days, 1), compared with budget. Completed projects use final spend. This assumes uniform spending pace, not measured work completion or earned value. Before work starts, or without sufficient inputs, cost is unavailable.
- `predictedTimeDelay` retains the legacy **duration-ratio** API contract: 100 means no overrun; 120 means 20% delay. The frontend subtracts 100 and floors at zero. Active projects continue past endDate. Completed duration is frozen at completedAt. Explicit actualTimeElapsed is honored, including zero. Legacy past-end projects with no status/actual duration stay Unknown until corrected; no blanket migration marks them late.
- Issue counts sum the existing equipment/labor/material counts. The source model has no separate resolved/open issue state; this preserves its reporting contract.
- The score remains a frontend review guideline: 40% cost, 40% delay, 20% issues; metric thresholds 5/15%, issues 3/10; overall 30/60. Confirm business calibration with leadership.

Daily observations are upserted by profile/day, with a unique database index. Writes capture today's metrics, and the server's 00:05 UTC job records unchanged profiles as time advances. Same-day updates replace that day's observation; past days are not reconstructed. History capture failures are logged and retried by the next daily job without misreporting an already-saved profile as failed. Run the server continuously for daily capture; downtime creates honest gaps. Multiple server instances share the same unique keys.

## Automated checks

```sh
npx jest src/controllers/bmdashboard/projectRiskProfileController.test.js src/utilities/__tests__/projectRiskMetrics.test.js src/services/projectRiskHistory.test.js src/helpers/__tests__/toolUtilizationHelpers.test.js --runInBand
```

Persistence tests use a disposable local MongoDB instance, real models and the Express router. No application database is used by these tests. Test roles are supplied by the test harness; production authentication remains in the existing JWT middleware.
