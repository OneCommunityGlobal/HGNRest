Check mark: ✅
Cross Mark: ❌

# Get All Projects

> ## Positive case

1. ❌ Receives a GET request in the **/api/projects** route
2. ✅ Returns 200 retrieves all projects, correctly sorted by modifiedDatetime in descending order.
3. ✅ Returns 200 if database contains no projects

> ## Negative case

1. ❌ Returns error 404 if the API does not exist
2. ✅ Returns 404 There is an error accessing the database, such as a connection issue
3. ✅ Returns 404 if any error occurs while getting all projects

> ## Edge case
