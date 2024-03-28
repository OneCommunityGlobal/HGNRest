Check mark: ✅
Cross Mark: ❌

# login 

> ## Positive case

1. ❌ Receives a POST request in the **/api/userProfile** route
2. ❌ Returns 200, if the user is a new user and there is a password match
3. ❌ Returns 200, if the user already exists and the password is a match

## Negative case

1. ✅ Returns error 400 if there is no email or password
2. ✅ Returns error 403 if there is no user
3. ❌ Returns error 403 if the user exists but is not active
4. ❌ Returns error 403 if the password is not a match and if the user already exists

## Edge case

1. ❌ Returns the error if the try block fails 