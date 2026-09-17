# Confirm Non-HGN Email Subscription Function

## Negative Cases

1. ❌ **Returns error 400 if `token` field is missing from the request**
   - Ensures that the function checks for the presence of the `token` field in the request body and responds with a `400` status code if it's missing.

2. ❌ **Returns error 401 if the provided `token` is invalid or expired**
   - Verifies that the function correctly handles invalid or expired JWT tokens and responds with a `401` status code.

3. ❌ **Returns error 400 if the decoded `token` does not contain a valid `email` field**
   - Ensures that the function validates the token payload contains a valid email address and responds with a `400` status code if it doesn't.

4. ❌ **Returns error 404 if subscription doesn't exist**
   - Verifies that the function only confirms existing subscriptions. If no subscription exists for the email in the token, it should return a `404` status code with a message directing the user to subscribe first.

5. ❌ **Returns error 500 if there is an internal error while updating the subscription**
   - Covers scenarios where there's a database error while updating the subscription status.

## Positive Cases

1. ✅ **Returns status 200 when an existing unconfirmed subscription is successfully confirmed**
   - Ensures that the function updates an existing unconfirmed subscription to confirmed status, sets `confirmedAt` timestamp, and enables `emailSubscriptions`.

2. ✅ **Returns status 200 if the email subscription is already confirmed (idempotent)**
   - Verifies that the function is idempotent - if a subscription is already confirmed, it returns success without attempting to update again.

3. ❌ **Correctly handles email normalization (lowercase)**
   - Ensures that email addresses are normalized to lowercase for consistent lookups, matching the schema's lowercase enforcement.
