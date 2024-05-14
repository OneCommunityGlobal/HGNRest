Check mark: ✅
Cross Mark: ❌

# Get User Profiles

> ## Positive case

1. ✅ Receives a GET request in the **/api/userProfile** route
2. ✅ Receives a 201 if an inventory item doesn't exist and is sucessfully created
3. ✅ Receives a 201 if an inventory item does exist and is updated with new values

> ## Negative case

1. ✅ Returns error 404 if the API does not exist
2. ❌ Returns error 403 if the user doesn't have the postInvInProjectWBS permission
3. ❌ Returns error 400 if valid project, but quantity and id are necessary as well as valid wbs if sent in and not Unassigned
4. ❌ Returns error 500 if saving an inventoryItem occurs

> ## Edge case
