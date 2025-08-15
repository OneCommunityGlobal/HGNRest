Check mark: ✅
Cross Mark: ❌

# Post Badge

> ## Positive case

1. ❌ Receives a POST request in the **/api/userProfile** route
2. ✅ Returns 200 if all is successful
3. ✅ Removes `allBadges` from cache if all is successful and the cache is not empty

> ## Negative case

1. ❌ Returns error 404 if the API does not exist
2. ✅ Returns 403 if the user is not authorized
3. ✅ Returns 400 if an error occurs in `findById`
4. ✅ Returns 400 if no badge is found

> ## Edge case
