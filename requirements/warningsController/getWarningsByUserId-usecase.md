Check mark: ✅
Cross Mark: ❌

# Get Warnings By User Id

> ## Positive case

1. ❌ Receives a POST request in the **/api/userProfile** route
2. ✅ Returns 201 if a warning was found given the user id

> ## Negative case

1. ❌ Returns error 404 if the API does not exist
2. ❌ Returns error 400 if warning with the user id given is not found
3. ❌ Returns error 401 if there is any error while retrieving a warning object

> ## Edge case
