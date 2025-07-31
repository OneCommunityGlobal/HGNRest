Check mark: ✅
Cross Mark: ❌

# Post Warnings By User Id

> ## Positive case

1. ❌ Receives a POST request in the **/api/userProfile** route
2. ✅ Returns a 201 if a succesfully creates a warning

> ## Negative case

1. ❌ Returns error 404 if the API does not exist
2. ❌ Returns error 400 if the user profile doesn't exist
3. ❌ Returns error 400 if findById errors
4. ❌ Returns error 400 if saving the warnings errors

> ## Edge case
