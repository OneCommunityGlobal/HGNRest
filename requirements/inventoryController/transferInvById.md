Check mark: ✅
Cross Mark: ❌

# Post Badge

> ## Positive case

1. ❌ Receives a POST request in the **/api/userProfile** route
2. ✅ Returns 201 if saving and updating an inventory item was successful
3. ✅ Returns 201 if it was sucessful in creating a new item and saving.

> ## Negative case

1. ❌ Returns error 404 if the API does not exist
2. ✅ Returns 403 if the user is not authorized to transfer inventory data
3. ✅ Returns 400 if the invenotry id provided does not have enough quantity to transfer.
4. ✅ Returns 500 if an error occurs when a newItem is found and findByIdAndUpdate fails
5. ✅ Returns 500 if an error occurs when a newItem is found and findByIdAndUpdate passes but findByIdAndUpdate fails when updating costPer
6. ✅ Returns 500 if an error occurs when saving a new item to the database
7. ✅ Returns 500 if an error occurs when searching for an item
8. ✅ Returns 500 if an error occurs when searching and updating an item in the database
9. ✅ Returns 400 if an invalid project, quanity and type id are passed.

> ## Edge case
