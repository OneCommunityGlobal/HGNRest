Check mark: ✅
Cross Mark: ❌

# Get User Profiles

> ## Positive case

1. ✅ Receives a GET request in the **/api/userProfile** route
2. ✅ Returns 200 if all is successful when `userType` is user and clears and resets cache.
3. ✅ Returns 200 if all is successful when `userType` is _not_ user.

> ## Negative case

1. ✅ Returns error 404 if the API does not exist
2. ✅ Returns 403 if user is not authorized.
3. ✅ Returns 500 if an error occurs when updating the user location.
4. ✅ Returns 500 if an error occurs when updating the map location.

> ## Edge case
