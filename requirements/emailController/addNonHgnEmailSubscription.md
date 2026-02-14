# Add Non-HGN Email Subscription Function

## Negative Cases

1. ❌ **Returns error 400 if `email` field is missing from the request**
   - Ensures that the function checks for the presence of the `email` field in the request body and responds with a `400` status code if it's missing.

2. ❌ **Returns error 400 if the provided `email` is invalid**
   - Verifies that the function validates email format using `isValidEmailAddress` and responds with a `400` status code for invalid emails.

3. ❌ **Returns error 400 if the provided `email` already exists in the subscription list**
   - This case checks that the function responds with a `400` status code and a message indicating that the email is already subscribed.

4. ❌ **Returns error 400 if the email is already an HGN user**
   - Verifies that the function checks if the email belongs to an existing HGN user and responds with a `400` status code, directing them to use the HGN account profile page.

5. ❌ **Returns error 500 if there is an internal error while checking the subscription list**
   - Covers scenarios where there's an issue querying the `EmailSubcriptionList` collection for the provided email (e.g., database connection issues).

6. ❌ **Returns error 500 if frontend URL cannot be determined from request origin**
   - Verifies that the function returns a `500` status code when the request's `Origin` or `Referer` header is missing or unparseable. The frontend URL is determined solely from request headers to correctly support multiple frontend domains (no env var fallback).

7. ❌ **Returns error 500 if there is an error sending the confirmation email**
   - This case handles any issues that occur while calling the `emailSender` function, such as network errors or service unavailability.

8. ❌ **Returns error 400 if there's a duplicate key error (race condition)**
   - Handles MongoDB duplicate key errors that might occur if the subscription is created simultaneously by multiple requests.

## Positive Cases

1. ✅ **Returns status 200 when a new email is successfully subscribed**
   - Ensures that the function successfully creates an unconfirmed subscription record, generates a JWT token, and sends the subscription confirmation email to the user.

2. ✅ **Creates subscription with correct initial state**
   - Verifies that the subscription is created with `isConfirmed: false`, `emailSubscriptions: true`, and proper normalization (lowercase email).

3. ✅ **Successfully sends a confirmation email containing the correct link**
   - Verifies that the generated JWT token is correctly included in the confirmation link, and the frontend URL is dynamically determined from the request's `Origin` or `Referer` header to support multiple frontend domains.

4. ✅ **Returns success even if confirmation email fails to send**
   - Ensures that if the subscription is saved to the database but the confirmation email fails, the function still returns success (subscription is already saved).

5. ❌ **Correctly normalizes email to lowercase**
   - Ensures that email addresses are stored in lowercase format, matching the schema's lowercase enforcement.
