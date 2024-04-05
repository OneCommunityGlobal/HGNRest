Check mark: ✅
Cross Mark: ❌

# Post Badge

> ## Positive case

1. ❌ Receives a POST request in the **/api/userProfile** route
2. ✅ Returns 200 and removes appropriate user from cache if successful and user exists in cache
3. ✅ Returns 200 and if successful and user does not exist in cache

> ## Negative case

1. ❌ Returns error 404 if the API does not exist
2. ✅ Returns 403 if the user is not authorized
3. ✅ Returns 500 if an error occurs in `findById`
4. ✅ Returns 400 if user is not found
5. ✅ Returns 500 if an error occurs when saving edited user profile

> ## Edge case
