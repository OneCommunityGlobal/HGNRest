# Remove Non-HGN Email Subscription Function Tests

## Negative Cases
1. ✅ **Returns error 400 if `email` field is missing from the request**
   - (Test: `should return 400 if email is missing`)

2. ❌ **Returns error 500 if there is an internal error while deleting the email subscription**

## Positive Cases
1. ❌ **Returns status 200 when an email is successfully unsubscribed**
