Check mark: ✅
Cross Mark: ❌

# Delete Warnings By User Id

> ## Positive case

1. ❌ Receives a POST request in the **/api/userProfile** route
2. ✅ Returns 201 if warning was found using the id and deleted.

> ## Negative case

1. ❌ Returns error 404 if the API does not exist
2. ❌ Returns error 401 if findOneAndUpdate fails
3. ❌ Returns error 400 if no warning was found and deleted.

> ## Edge case
