Check mark: ✅
Cross Mark: ❌

# Get User Profiles

> ## Positive case

1. ✅ Receives a GET request in the **/api/userProfile** route
2. ✅ Returns 201 if all is successful

> ## Negative case

1. ✅ Returns error 404 if the API does not exist
2. ✅ Returns 403 if the user does not have permission
3. ✅ Returns 400 if `req.body` does not contain `wbsName` or `isActive`
4. ✅ returns 500 if an error occurs when saving

> ## Edge case
