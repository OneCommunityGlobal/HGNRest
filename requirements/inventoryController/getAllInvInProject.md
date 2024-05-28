Check mark: ✅
Cross Mark: ❌

# Get User Profiles

> ## Positive case

1. ✅ Receives a GET request in the **/api/userProfile** route
2. ✅ Returns status 200 if results are found popluated and sorted

> ## Negative case

1. ✅ Returns error 404 if the API does not exist
2. ❌ Returns error 403 if the user does not have the permission getAllInvInProject

3. ❌ Returns error 404 if any errors when fetching from database or populate error occurs

> ## Edge case
