# Update Email Subscriptions Function

## Negative Cases

1. ❌ **Returns error 400 if `emailSubscriptions` field is missing from the request**
   - This ensures that the function checks for the presence of the `emailSubscriptions` field in the request body and responds with a `400` status code if it's missing.

2. ❌ **Returns error 400 if `email` field is missing from the requestor object**
   - Ensures that the function requires an `email` field within the `requestor` object in the request body and returns `400` if it's absent.

3. ❌ **Returns error 404 if the user with the provided `email` is not found**
   - This checks that the function correctly handles cases where no user exists with the given `email` and responds with a `404` status code.

4. ✅ **Returns error 500 if there is an internal error while updating the user profile**
   - Covers scenarios where there's a database error while updating the user's email subscriptions.

## Positive Cases

1. ❌ **Returns status 200 and the updated user when email subscriptions are successfully updated**
   - Ensures that the function updates the `emailSubscriptions` field for the user and returns the updated user document along with a `200` status code.
