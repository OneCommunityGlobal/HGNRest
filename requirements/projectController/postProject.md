Check mark: ✅
Cross Mark: ❌

# Post Project

> ## Positive case

1. ❌ Receives a Post request in the **/api/projects** route
2. ✅ Check if user has permissions for **postProject**
3. ✅ Check if projectName provided corresponds to aproject in the database
4. ✅ Save the project with request body
5. ✅ Returns **201**, with a new `project`.

> ## Negative case

1. ✅ Returns error 403 if the user does not have permissions for **postProject**
2. ✅ Returns 400 if the status is empty
3. ✅ Returns 400 if the projectName is empty
4. ✅ Returns error 500 if any error occurs when finding a project
5. ✅ Returns error 400 if the projectName exists.
6. ✅ Returns 500 if an error occurs in saving

> ## Edge case

1. ❌ Returns 400 if projectName is invalid (doesnot match the regex)