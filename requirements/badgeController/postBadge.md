Check mark: ✅
Cross Mark: ❌

# Post Badge

> ## Positive case

1. ❌ Receives a POST request in the **/api/userProfile** route
2. ❌ Returns 201 if a badge is succesfully created.

> ## Negative case

1. ❌ Returns error 404 if the API does not exist
2. ❌ Returns 403 if the user does not have badge permissions
3. ❌ Returns 400 if another badge with name already exists
4. ❌ Returns 400 if another badge with name already exists
5. ❌ Returns 500 if any error occurs when finding a badge
6. ❌ Returns 500 if any error occurs when saving the new badge

> ## Edge case
