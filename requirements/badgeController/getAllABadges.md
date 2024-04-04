Check mark: ✅
Cross Mark: ❌

# Post Badge

> ## Positive case

1. ❌ Receives a POST request in the **/api/userProfile** route
2. ✅ Returns 200 if the badges are in cache
3. ✅ Returns 200 if not in cache, and all the async code succeeds.

> ## Negative case

1. ❌ Returns error 404 if the API does not exist
2. ✅ Returns 403 if the user is not authorized
3. ✅Returns 500 if an error occurs when querying the DB

> ## Edge case
