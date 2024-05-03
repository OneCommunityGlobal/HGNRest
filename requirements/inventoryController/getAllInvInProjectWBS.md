Check mark: ✅
Cross Mark: ❌

# Get User Profiles

> ## Positive case

1. ✅ Receives a GET request in the **/api/userProfile** route
2. ✅ Returns status 200 if results are found sorted and popluated

> ## Negative case

1. ✅ Returns error 404 if the API does not exist
2. ❌ Returns error 403 if the user is not authorized to view the inventory data.
3. ❌ Returns error 404 if an error occurs when fetching from the database

> ## Edge case
