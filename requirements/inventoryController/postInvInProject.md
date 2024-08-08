Check mark: ✅
Cross Mark: ❌

# Post Badge

> ## Positive case

1. ❌ Receives a POST request in the **/api/userProfile** route
2. ✅ Returns 201 if succesfully saved data to database
3. ✅ Returns 201 if succesfully updated an item in the database.

> ## Negative case

1. ❌ Returns error 404 if the API does not exist
2. ✅ Returns 403 if the user is not authorized to post new inventory.
3. ✅ Returns 400 if an error occurs when fetching from the database.
4. ✅ Returns 500 if an error occurs when updating an inventory item
5. ✅ Returns 500 if an error occurs when saving to the database

> ## Edge case
