Check mark: ✅
Cross Mark: ❌

# Put Project

> ## Positive case

1. ❌ Receives a PUT request in the **/api/projects** route
2. ✅ Check if user has permissions for **putProject**
3. ✅ Check if project ID provided is found in the database
4. ✅ Save the project with request body
5. ✅ Returns **201**, with a `project.id`.

> ## Negative case

1. ✅ Returns error 403 if the user does not have permissions for **putProject**
2. ✅ Returns error 500 if an error occurs in `findById`
3. ✅ Returns error 400 if the project ID provided does not correspond to any project in the database.
4. ✅ Returns 500 if an error occurs in saving

> ## Edge case

1. ❌ Returns 400 if projectId is invalid