Check mark: ✅
Cross Mark: ❌

# Delete Project

> ## Positive case

1. ❌ Receives a DELETE request in the **/api/projects** route
2. ✅ check if user has permissions for **deleteProject**
3. ✅ check if project ID provided is found in the database
4. ✅ check if checks for associated time entries.
5. ✅ check if there are no time entries associated with the project
6. ✅ if there are no associated time entries, and both database operations (project deletion and user profile update) succeed
7. ✅ Returns **200**, with a success message.

> ## Negative case

1. ❌ Returns error 403 if the user does not have permissions for **deleteProject**
2. ❌ Returns error 500 if an error occurs in `findById`
3. ❌ Returns error 400 if the project ID provided does not correspond to any project in the database.
4. ❌ Returns 500 if an error occurs in finding timeenrties
5. ❌ Returns error 400 if the project has one or more associated time entries
6. ❌ Returns 500 userProfile updateMany fails
7. ❌ Returns 500 if record.remove() fails

> ## Edge case

1. ❌ Returns 400 if projectId is invalid

