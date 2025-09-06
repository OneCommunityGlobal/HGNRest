Check mark: ✅
Cross Mark: ❌

# Get User Profiles

> ## Positive case

1. ✅ Receives a GET request in the **/api/userProfile** route
2. ✅ Returns 204 if the user profile's role is not equal to 'Owner'
3. ✅ Returns 200 if the user profile's role is equal to 'Owner'

> ## Negative case

1. ✅ Returns error 404 if the API does not exist
2. ❌ Returns 403 if the user profile could not be found
3. ❌ Returns 400 if any error occurs

> ## Edge case
