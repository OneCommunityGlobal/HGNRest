# Resend Email Function

## Negative Cases

1. ❌ **Returns error 401 if `requestor` is missing from the request**
   - Ensures that the function checks for the presence of `requestor.requestorId` in the request body and responds with a `401` status code if it's missing.

2. ❌ **Returns error 403 if user doesn't have `sendEmails` permission**
   - Verifies that the function checks user permissions and responds with a `403` status code if the user is not authorized to resend emails.

3. ❌ **Returns error 400 if `emailId` is missing or invalid**
   - Ensures that the function validates `emailId` is a valid MongoDB ObjectId.

4. ❌ **Returns error 404 if the original email is not found**
   - Verifies that the function handles cases where the email with the provided `emailId` doesn't exist.

5. ❌ **Returns error 400 if `recipientOption` is missing**
   - Ensures that the `recipientOption` field is required in the request body.

6. ❌ **Returns error 400 if `recipientOption` is invalid**
   - Verifies that the `recipientOption` must be one of: `'all'`, `'specific'`, or `'same'`.

7. ❌ **Returns error 400 if `specificRecipients` is required but missing for 'specific' option**
   - Ensures that when `recipientOption` is `'specific'`, the `specificRecipients` array must be provided and non-empty.

8. ❌ **Returns error 404 if no recipients found for 'same' option**
   - Verifies that when `recipientOption` is `'same'`, the original email must have EmailBatch items with recipients.

9. ❌ **Returns error 400 if recipient count exceeds maximum limit for 'specific' option**
   - Ensures that when using `'specific'` option, the recipient limit (2000) is enforced.

10. ❌ **Returns error 400 if no recipients are found**
    - Verifies that after determining recipients, at least one recipient must be available.

11. ❌ **Returns error 404 if requestor user is not found**
    - Ensures that the function validates the requestor exists in the userProfile collection.

12. ❌ **Returns error 500 if there is an internal error during email creation**
    - Covers scenarios where there are database errors or service failures during email/batch creation.

## Positive Cases

1. ✅ **Returns status 200 when email is successfully resent with 'all' option**
   - Ensures that when `recipientOption` is `'all'`, the function sends to all active HGN users and confirmed email subscribers.

2. ✅ **Returns status 200 when email is successfully resent with 'specific' option**
   - Verifies that when `recipientOption` is `'specific'`, the function sends to only the provided `specificRecipients` list.

3. ✅ **Returns status 200 when email is successfully resent with 'same' option**
   - Ensures that when `recipientOption` is `'same'`, the function extracts recipients from the original email's EmailBatch items and deduplicates them.

4. ✅ **Creates new email copy with same subject and HTML content**
   - Verifies that the function creates a new Email document with the same `subject` and `htmlContent` as the original, but with a new `createdBy` user.

5. ✅ **Enforces recipient limit only for 'specific' option**
   - Ensures that the maximum recipient limit is enforced only when `recipientOption` is `'specific'`, but skipped for `'all'` and `'same'` (broadcast scenarios).

6. ✅ **Skips recipient limit for broadcast scenarios ('all' and 'same')**
   - Verifies that when using `'all'` or `'same'` options, the recipient limit is not enforced.

7. ✅ **Deduplicates recipients for 'same' option**
   - Ensures that when using `'same'` option, duplicate email addresses are removed from the recipient list.

8. ✅ **Creates email batches in a transaction**
   - Ensures that the parent Email and all EmailBatch items are created atomically in a single transaction.

9. ❌ **Handles transaction rollback on errors**
   - Ensures that if any part of email/batch creation fails, the entire transaction is rolled back.

