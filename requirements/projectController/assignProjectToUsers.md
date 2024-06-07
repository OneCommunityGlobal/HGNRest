Check mark: ✅
Cross Mark: ❌

# Assign Project to Users

> ## Positive case

1. ❌ Receives a Post request in the **/api/project/:projectId/users/** route
2. ✅ Check if user has permissions for **assignProjectToUsers**
3. ✅ Check if projectId provided corresponds to a project in the database
4. ✅ Assign the project to the user profiles in the assign list
5. ✅ Unassign the user profiles in unassign list
6. ✅ Returns **200**, when the pormises are resolved with `{ result: 'Done' })`.

> ## Negative case

1. ✅ Returns error 403 if the user does not have permissions for **assignProjectToUsers**
2. ✅ Returns 400 if the projectId or users is empty
3. ✅ Returns error 400 if the project ID provided does not correspond to any project in the database
4. ✅ Returns error 400 if the project does not exist
5. ✅ Returns 400 if the project list is empty
6. ✅ Returns 500 if an error occurs in findById
7. ✅ Returns 500 if an error occurs when assign and unassigns users correctly

> ## Edge case

1. ❌ Returns 400 if projectName is invalid (doesnot match the regex)