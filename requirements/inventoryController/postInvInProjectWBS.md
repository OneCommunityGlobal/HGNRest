Check mark: ✅
Cross Mark: ❌

# Post Badge

> ## Positive case

1. ❌ Receives a POST request in the **/api/userProfile** route
2. ❌ Returns status code 201, if the inventory was successfully created and saved
3. ❌ Returns status code 201, if the inventory item was succesfully updated and saved.

> ## Negative case

1. ❌ Returns error 404 if the API does not exist
2. ✅ Returns error 403 if the user is not authorized to view data
3. ✅ Returns error 500 if an error occurs when saving
4. ✅ Returns error 400 if a valid project was found but quantity and type id were missing

> ## Edge case
