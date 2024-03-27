Check mark: ✅
Cross Mark: ❌

# Get User Profiles

> ## Positive case

1. ✅ Receives a POST request in the **/api/userProfile** route
2. ❌ Returns 200 id there are no users in the database and the allusers key exists in NodeCache.
3. Returns 200 if there are users in the database

> ## Negative case

1. ✅ Returns error 404 if the API does not exist
2. ✅ Returns 400 if the user doesn't have
   getUserProfiles permission
3. ❌ Returns 500 if there are no users in the database and the allusers key doesn't exist in NodeCache
4. ❌ Returns 404 if any error occurs while getting all user profiles

> ## Edge case
