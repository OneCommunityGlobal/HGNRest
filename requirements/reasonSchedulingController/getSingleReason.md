Check mark: ✅
Cross Mark: ❌

# getSingleReason

> ## Positive case
1. ❌ Receives a GET request in the **/api/reason/single/:userId** route.
2. ✅ Return 200 if not found schedule reason and return empty object successfully.
3. ✅ Return 200 if found schedule reason and return reason successfully.

> ## Negative case
1. ✅ Returns 404 when any error in find user by Id
2. ✅ Returns 400 when any error in fetching the user

> ## Edge case