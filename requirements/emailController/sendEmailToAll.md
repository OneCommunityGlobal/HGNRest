# Send Email to All Function

## Negative Cases

1. ❌ **Returns error 400 if `subject` or `html` fields are missing from the request**
   - The request should be rejected if either the `subject` or `html` content is not provided in the request body.

2. ❌ **Returns error 500 if there is an internal error while fetching users**
   - This case covers scenarios where there's an error fetching users from the `userProfile` collection (e.g., database connection issues).

3. ❌ **Returns error 500 if there is an internal error while fetching the subscription list**
   - This case covers scenarios where there's an error fetching emails from the `EmailSubcriptionList` collection.

4. ❌ **Returns error 500 if there is an error sending emails**
   - This case handles any issues that occur while calling the `emailSender` function, such as network errors or service unavailability.

## Positive Cases

1. ❌ **Returns status 200 when emails are successfully sent to all active users**
   - Ensures that the function sends emails correctly to all users meeting the criteria (`isActive` and `EmailSubcriptionList`).

2. ❌ **Returns status 200 when emails are successfully sent to all users in the subscription list**
   - Verifies that the function sends emails to all users in the `EmailSubcriptionList`, including the unsubscribe link in the email body.

3. ❌ **Combines user and subscription list emails successfully**
   - Ensures that the function correctly sends emails to both active users and the subscription list without issues.
