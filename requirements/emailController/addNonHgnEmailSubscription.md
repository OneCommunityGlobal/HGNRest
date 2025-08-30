# Add Non-HGN Email Subscription Function

## Negative Cases

1. ❌ **Returns error 400 if `email` field is missing from the request**
   - Ensures that the function checks for the presence of the `email` field in the request body and responds with a `400` status code if it's missing.

2. ❌ **Returns error 400 if the provided `email` already exists in the subscription list**
   - This case checks that the function responds with a `400` status code and a message indicating that the email is already subscribed.

3. ❌ **Returns error 500 if there is an internal error while checking the subscription list**
   - Covers scenarios where there's an issue querying the `EmailSubscriptionList` collection for the provided email (e.g., database connection issues).

4. ❌ **Returns error 500 if there is an error sending the confirmation email**
   - This case handles any issues that occur while calling the `emailSender` function, such as network errors or service unavailability.

## Positive Cases

1. ❌ **Returns status 200 when a new email is successfully subscribed**
   - Ensures that the function successfully creates a JWT token, constructs the email, and sends the subscription confirmation email to the user.

2. ❌ **Successfully sends a confirmation email containing the correct link**
   - Verifies that the generated JWT token is correctly included in the confirmation link sent to the user in the email body.
