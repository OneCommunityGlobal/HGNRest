# Send Email to All Subscribers Function

## Negative Cases

1. ❌ **Returns error 401 if `requestor` is missing from the request**
   - Ensures that the function checks for the presence of `requestor.requestorId` in the request body and responds with a `401` status code if it's missing.

2. ❌ **Returns error 403 if user doesn't have `sendEmails` permission**
   - Verifies that the function checks user permissions and responds with a `403` status code if the user is not authorized to send emails to subscribers.

3. ❌ **Returns error 400 if `subject` or `html` fields are missing from the request**
   - The request should be rejected if either the `subject` or `html` content is not provided in the request body.

4. ❌ **Returns error 400 if email contains unreplaced template variables**
   - Verifies that the function validates that all template variables in `subject` and `html` have been replaced before sending.

5. ❌ **Returns error 404 if requestor user is not found**
   - Ensures that the function validates the requestor exists in the userProfile collection.

6. ❌ **Returns error 400 if no recipients are found**
   - Verifies that the function checks if there are any active HGN users or confirmed email subscribers before creating the email.

7. ❌ **Returns error 500 if there is an internal error while fetching users**
   - This case covers scenarios where there's an error fetching users from the `userProfile` collection (e.g., database connection issues).

8. ❌ **Returns error 500 if there is an internal error while fetching the subscription list**
   - This case covers scenarios where there's an error fetching emails from the `EmailSubcriptionList` collection.

9. ❌ **Returns error 500 if there is an error creating email or batches**
   - Covers scenarios where there are database errors or service failures during email/batch creation.

## Positive Cases

1. ✅ **Returns status 200 when emails are successfully created for all active users**
   - Ensures that the function sends emails correctly to all users meeting the criteria (`isActive: true`, `emailSubscriptions: true`, non-empty `firstName`, non-null `email`).

2. ✅ **Returns status 200 when emails are successfully created for all confirmed subscribers**
   - Verifies that the function sends emails to all confirmed subscribers in the `EmailSubcriptionList` (with `isConfirmed: true` and `emailSubscriptions: true`).

3. ✅ **Combines user and subscription list emails successfully**
   - Ensures that the function correctly combines recipients from both active HGN users and confirmed email subscribers without duplicates.

4. ✅ **Skips recipient limit for broadcast emails**
   - Verifies that the maximum recipient limit is NOT enforced when broadcasting to all subscribers.

5. ✅ **Creates email batches in a transaction**
   - Ensures that the parent Email and all EmailBatch items are created atomically in a single transaction.

6. ❌ **Handles transaction rollback on errors**
   - Ensures that if any part of email/batch creation fails, the entire transaction is rolled back.
