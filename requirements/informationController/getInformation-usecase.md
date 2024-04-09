Check mark: ✅
Cross Mark: ❌

# Get Information

> ## Positive case

1. ✅ Receives a GET request in the **/api/informations** route
2. ✅ Returns 200 if the informations key exists in NodeCache.
3. ❌ Returns 200 if there are information in the database

> ## Negative case
1. ❌ Returns error 404 if any error occurs while getting informations. 
2. ❌ Returns error 500 if the informations key doesn't exist in NodeCache and no information in the database.



> ## Edge case
