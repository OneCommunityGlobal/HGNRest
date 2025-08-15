Check mark: ✅
Cross Mark: ❌

# Post Forgot Pwd

> ## Positive case

1. ✅ Receives a POST request in the **/api/forgotpassword** route.
2. ✅ Returns **200** if successfully temporary password generated.

> ## Negative case

1. ✅ Returns error 404 if the API does not exist.
2. ✅ Returns 400 user does not exists in database.
3. ✅ Returns 500 if error encountered fetching user details from database.
4. ✅ Returns 500 if error encountered while saving temporary password.