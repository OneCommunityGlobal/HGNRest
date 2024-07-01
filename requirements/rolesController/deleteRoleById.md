Check mark: ✅
Cross Mark: ❌

## deleteRoleById Function

> ### Positive case
1. ✅ Should return 200 and the deleted role on success
   - Receives a DELETE request
   - User has permission
   - Successfully deletes the role from the database

> ### Negative case
2. ✅ Should return 403 if user lacks permission
   - Receives a DELETE request
   - User does not have permission
