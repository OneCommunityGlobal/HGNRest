# Get Email Details (Outbox) Function

## Negative Cases

1. ❌ **Returns error 401 if `requestor` is missing from the request**
   - Ensures that the function checks for the presence of `requestor.requestorId` in the request body and responds with a `401` status code if it's missing.

2. ❌ **Returns error 403 if user doesn't have `sendEmails` permission**
   - Verifies that the function checks user permissions and responds with a `403` status code if the user is not authorized to view email details.

3. ❌ **Returns error 400 if email ID is invalid**
   - Ensures that the function validates the email ID from `req.params.emailId` is a valid MongoDB ObjectId format.

4. ❌ **Returns error 404 if email is not found**
   - Verifies that the function handles cases where no email exists with the provided ID and responds with a `404` status code.

5. ❌ **Returns error 500 if there is an internal error while fetching email details**
   - Covers scenarios where there are database errors or service failures while fetching the email and its associated EmailBatch items.

## Positive Cases

1. ✅ **Returns status 200 with email and batch details**
   - Ensures that the function successfully fetches the parent Email record and all associated EmailBatch items and returns them in the response.

2. ✅ **Returns complete email information**
   - Verifies that the response includes all email fields: `_id`, `subject`, `htmlContent`, `status`, `createdBy`, `createdAt`, `startedAt`, `completedAt`, `updatedAt`.

3. ✅ **Returns all associated EmailBatch items**
   - Ensures that all EmailBatch items associated with the email are included in the response, with all batch details (recipients, status, attempts, timestamps, etc.).

4. ✅ **Returns email with populated creator information**
   - Verifies that the `createdBy` field is populated with user profile information (firstName, lastName, email).

5. ❌ **Handles emails with no batches gracefully**
   - Verifies that if an email has no associated EmailBatch items, the function returns the email with an empty batches array without error.

6. ❌ **Returns correct data structure**
   - Ensures that the response follows the expected structure with email details and associated batches properly nested.

