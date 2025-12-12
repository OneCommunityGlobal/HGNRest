# Get All Emails (Outbox) Function

## Negative Cases

1. ❌ **Returns error 401 if `requestor` is missing from the request**
   - Ensures that the function checks for the presence of `requestor.requestorId` in the request body and responds with a `401` status code if it's missing.

2. ❌ **Returns error 403 if user doesn't have `sendEmails` permission**
   - Verifies that the function checks user permissions and responds with a `403` status code if the user is not authorized to view emails.

3. ❌ **Returns error 500 if there is an internal error while fetching emails**
   - Covers scenarios where there are database errors or service failures while fetching email records.

## Positive Cases

1. ✅ **Returns status 200 with all email records**
   - Ensures that the function successfully fetches all Email (parent) records from the database and returns them in the response.

2. ✅ **Returns emails ordered by creation date (descending)**
   - Verifies that emails are returned sorted by `createdAt` in descending order (newest first).

3. ✅ **Returns emails with populated creator information**
   - Ensures that the `createdBy` field is populated with user profile information (firstName, lastName, email).

4. ✅ **Returns complete email metadata**
   - Verifies that the response includes all email fields: `_id`, `subject`, `htmlContent`, `status`, `createdBy`, `createdAt`, `startedAt`, `completedAt`, `updatedAt`.

5. ❌ **Handles empty email list gracefully**
   - Verifies that if no emails exist, the function returns an empty array without error.

