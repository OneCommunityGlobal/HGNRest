Check mark: ✅
Cross Mark: ❌

# Get Project By Id

> ## Positive case

1. ❌ Receives a GET request in the **/api/project/:projectId** route
2. ✅ Returns 200 retrieves the project data when findById is successful

> ## Negative case

1. ❌ Returns error 404 if the API does not exist
2. ✅ Returns 404 There is an error accessing the database, such as a connection issue
3. ✅ Return 404 status and the error object when findById fails

> ## Edge case
