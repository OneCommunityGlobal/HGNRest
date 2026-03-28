# Remove Non-HGN Email Subscription Function

## Negative Cases

1. ✅ **Returns error 400 if `email` field is missing from the request**
   - Ensures that the function checks for the presence of the `email` field in the request body and responds with a `400` status code if it's missing.

2. ❌ **Returns error 400 if the provided `email` is invalid**
   - Verifies that the function validates email format using `isValidEmailAddress` and responds with a `400` status code for invalid emails.

3. ❌ **Returns error 404 if the email subscription is not found**
   - Verifies that the function handles cases where no subscription exists for the given email and responds with a `404` status code.

4. ❌ **Returns error 500 if there is an internal error while deleting the email subscription**
   - Covers scenarios where there's a database error while deleting the subscription (e.g., database connection issues).

## Positive Cases

1. ✅ **Returns status 200 when an email is successfully unsubscribed**
   - Ensures that the function deletes the subscription record from the `EmailSubcriptionList` collection and returns success with a `200` status code.

2. ✅ **Correctly normalizes email to lowercase for lookup**
   - Verifies that the email is normalized to lowercase before querying/deleting, ensuring consistent matches with the schema's lowercase enforcement.

3. ✅ **Uses direct email match (no regex needed)**
   - Ensures that since the schema enforces lowercase emails, the function uses direct email matching instead of case-insensitive regex.

4. ❌ **Handles concurrent unsubscribe requests gracefully**
   - Ensures that if multiple unsubscribe requests are made simultaneously, the function handles race conditions appropriately.
