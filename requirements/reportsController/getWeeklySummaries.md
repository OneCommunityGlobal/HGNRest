Check mark: ✅
Cross Mark: ❌

# Get Weekly Summaries

> ## Positive case

1. ❌ Receives a GET request in the **/api/reports/weeklysummaries** route
2. ❌ Returns 200 if there are summaries in the database

> ## Negative case

1. ❌ Returns error 404 if the API does not exist
2. ❌ Returns 403 if the user doesn't have getWeeklySummaries permission
3. ❌ Returns 404 if any error occurs while getting all summaries

> ## Edge case