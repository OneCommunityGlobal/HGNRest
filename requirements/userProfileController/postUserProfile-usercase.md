Check mark: ✅
Cross Mark: ❌

# Post User Profile

> ## Positive case

1. ❌ Receives a POST request in the **/api/userProfile** route
2. ✅ check if user has permissions for **postUserProfile**
3. ✅ check if user has permissions for **addDeleteEditOwners** or if the user role is **owner**
4. ✅ verify if the email address is already in use
5. ✅ check if environment is not dev environment **hgnData_dev**
6. ✅ check if firstname and lastname exist
7. ✅ Save user profile
8. ✅ Returns **200**, with the id of userProfile created

> ## Negative case

1. ❌ Returns error 404 if the API does not exist
2. ✅ Returns error 403 if the user doesn't have permissions for **postUserProfile**
3. ✅ Returns error 403 if the user doesn't have permissions for **addDeleteEditOwners** and if the user role is an **owner**
4. ✅ Returns error 400 if the email address is already in use
5. ✅ Returns error 400 if in dev environment, the role is owner or administrator and the actual email or password are incorrect
6. ✅ Returns 400 if the firstname and lastname already exist and if no duplicate name is allowed
7. ✅ Returns error 501 if there is an error when trying to create the userProfile

> ## Edge case

1. ❌ Returns 400 if email is invalid
2. ❌ Returns 400 if password is invalid
3. ❌ Returns 400 if teamcode is invalid
