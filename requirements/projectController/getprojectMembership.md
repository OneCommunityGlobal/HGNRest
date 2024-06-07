Check mark: ✅
Cross Mark: ❌

# Get Projects Membership

> ## Positive case

1. ❌ Receives a GET request in the **/api/projects** route
2. ✅ Returns 200 and project membership

> ## Negative case

1. ❌ Returns error 404 if the API does not exist
2. ✅ Returns 500 if an error accessing the database
3. ✅ Returns 400 status if the projectID is Invalid
> ## Edge case
