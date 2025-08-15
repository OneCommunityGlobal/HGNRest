Check mark: ✅
Cross Mark: ❌

# Post Badge

> ## Positive case

1. ❌ Receives a POST request in the **/api/userProfile** route
2. ✅ Returns 200 if the badge is successfully removed and all instances of the badge are removed from user profiles.
3. ✅ Clears cache if cache exists.

> ## Negative case

1. ❌ Returns error 404 if the API does not exist
2. ✅ Returns 403 if the user does not have permission to delete badges
3. ✅ Returns 400 if an no badge is found
4. ✅ Returns 500 if the removeBadgeFromProfile fails.
5. ✅ Returns 500 if the remove method fails.

> ## Edge case
