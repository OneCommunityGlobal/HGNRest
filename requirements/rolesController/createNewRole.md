Check mark: ✅
Cross Mark: ❌

## createNewRole Function

> ### Positive case
1. ✅ Should return 201 and the new role on success
   - Receives a POST request
   - User has permission
   - Mandatory fields are provided
   - Successfully saves the new role to the database

> ### Negative case
2. ✅ Should return 403 if user lacks permission
   - Receives a POST request
   - User does not have permission
3. ✅ Should return 400 if mandatory fields are missing
   - Receives a POST request
   - User has permission
   - Mandatory fields are not provided
4. ✅ Should return 500 on role save error
   - Receives a POST request
   - User has permission
   - Error occurs while saving the new role to the database
