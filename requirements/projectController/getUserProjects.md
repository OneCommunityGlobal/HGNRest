Check mark: ✅
Cross Mark: ❌

# Get user projects

> ## Positive case

1. ❌ Receives a GET request in the **/api/projects/user/:userId** route
2. ✅ Returns 200 status and the userProject data when findById is successful

> ## Negative case

1. ❌ Returns error 404 if the API does not exist
2. ✅ Returns 404 There is an error accessing the database, such as a connection issue
3. ✅ Returns 400 status and the error object when findById fails

> ## Edge case
