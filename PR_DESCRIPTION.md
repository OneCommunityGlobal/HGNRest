# Description
Fixes issue where the "Longest Open Issues" chart was limiting results to only 7 issues when multiple projects were selected, causing some issues to be hidden. Also fixes issue numbering consistency when multiple projects are selected.

Fixes #4301 (Phase 2 Bugs - Priority Medium)

## Related PRs (if any):
Related to Frontend PR: #4653
To test this backend PR, you need to checkout the corresponding frontend PR branch.

## Main changes explained:
- **Updated `bmIssueController.js`** - `getLongestOpenIssues` function:
  - Removed `.slice(0, 7)` limit to return all issues from selected projects instead of just top 7
  - Added `issueId` to response (MongoDB `_id` as string) for consistent issue identification
  - Added `projectId` to response to enable per-project issue numbering
  - Added `projectName` to response to distinguish issues across projects
  - Updated query to select `_id` field along with `issueTitle` and `issueDate`
  - Handle empty `issueTitle` arrays by returning `null` instead of `undefined`

## How to test:
1. Checkout branch `vamsidhar-fix/issue-chart-all-issues-visible`
2. Run `npm run build` to compile the changes
3. Restart the backend server
4. Ensure the frontend is running with the corresponding frontend PR branch
5. Navigate to BMDashboard → Issues → Longest Open Issues chart
6. **Test Scenario 1: Select only "Building 3"**
   - Should show all Building 3 issues (e.g., "Paint Peeling in Conference Room", "Issue #1", "Issue #2", "Issue #3", "Issue #4")
   - Verify all issues are displayed, not limited to 7
7. **Test Scenario 2: Select "Building 3" and "Building 1" together**
   - Should show ALL issues from both projects (not limited to 7)
   - Should include all Building 3 issues (Issue #1, #2, #3, #4) AND all Building 1 issues
   - Verify no issues are missing compared to when selecting projects individually
   - Check backend console logs - should see: `[getLongestOpenIssues] Total issues found: X, Returning: X issues` where X is the total count (should be more than 7 for multiple projects)
8. **Test Scenario 3: Select multiple projects with many issues**
   - Verify all issues are displayed, sorted by duration (longest first)
   - Check backend console logs to verify the count of issues being returned
   - Verify the response includes `issueId`, `projectId`, and `projectName` fields for each issue

## Expected behavior:
- When selecting multiple projects, ALL issues from all selected projects should be visible
- Issues should be sorted by duration (longest open first)
- No limit on the number of issues displayed
- Each issue should have a unique `issueId` for consistent identification
- Response should include `projectId` and `projectName` for frontend processing

## Technical details:
- The API endpoint `/bm/issues/longest-open` now returns all matching issues instead of limiting to 7
- Response includes `issueId`, `projectId`, and `projectName` fields for frontend processing
- Issues with empty `issueTitle` arrays return `null` for `issueName` (frontend will generate names)
- Debug logging added to verify issue counts in console

## Note:
This PR only includes backend changes. The frontend PR (#4653) will handle:
- Using `issueId` for consistent issue numbering
- Per-project issue numbering to avoid conflicts
- Prefixing unnamed issues with project name when multiple projects are selected
