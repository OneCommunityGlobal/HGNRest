Check mark: ✅
Cross Mark: ❌

## updateRoleById Function

> ### Positive case
1. ✅ Should return 201 and the updated role on success
   - Receives a PUT request
   - User has permission
   - Mandatory fields are provided
   - Successfully updates the role in the database

> ### Negative case
2. ✅ Should return 403 if user lacks permission
   - Receives a PUT request
   - User does not have permission
3. ✅ Should return 400 if mandatory fields are missing
   - Receives a PUT request
   - User has permission
   - Mandatory fields are not provided
4. ✅ Should return 400 if no valid records are found
   - Receives a PUT request
   - User has permission
   - No valid records are found to update
5. ✅ Should return 500 on role save error
   - Receives a PUT request
   - User has permission
   - Error occurs while saving the updated role to the database
