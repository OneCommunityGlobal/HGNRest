# Confirm Non-HGN Email Subscription Function Tests

## Negative Cases
1. ✅ **Returns error 400 if `token` field is missing from the request**
   - (Test: `should return 400 if token is not provided`)

2. ✅ **Returns error 401 if the provided `token` is invalid or expired**
   - (Test: `should return 401 if token is invalid`)

3. ✅ **Returns error 400 if the decoded `token` does not contain a valid `email` field**
   - (Test: `should return 400 if email is missing from payload`)

4. ❌ **Returns error 500 if there is an internal error while saving the new email subscription**

## Positive Cases
1. ❌ **Returns status 200 when a new email is successfully subscribed**

2. ❌ **Returns status 200 if the email is already subscribed (duplicate email)**
