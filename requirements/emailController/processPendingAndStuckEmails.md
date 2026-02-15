# Process Pending and Stuck Emails Function

## Negative Cases

1. ❌ **Returns error 401 if `requestor` is missing from the request**
   - Ensures that the function checks for the presence of `requestor.requestorId` in the request body and responds with a `401` status code if it's missing.

2. ❌ **Returns error 403 if user doesn't have `sendEmails` permission**
   - Verifies that the function checks user permissions and responds with a `403` status code if the user is not authorized to process emails.

3. ❌ **Returns error 500 if there is an internal error while processing**
   - Covers scenarios where there are errors during the processing of pending and stuck emails (e.g., database errors, service failures).

## Positive Cases

1. ✅ **Returns status 200 when processing is triggered successfully**
   - Ensures that the function triggers the email processor to handle pending and stuck emails and returns success.

2. ✅ **Resets stuck emails (SENDING status) to PENDING**
   - Verifies that emails in SENDING status are reset to PENDING so they can be reprocessed (typically after server restart).

3. ✅ **Resets stuck batches (SENDING status) to PENDING**
   - Ensures that EmailBatch items in SENDING status are reset to PENDING so they can be reprocessed.

4. ✅ **Queues all PENDING emails for processing**
   - Verifies that all emails in PENDING status are added to the processing queue for immediate processing.

5. ✅ **Handles errors gracefully without throwing**
   - Ensures that individual errors during processing (e.g., resetting a specific stuck email) are logged but don't prevent the overall process from completing.

6. ❌ **Provides detailed logging for troubleshooting**
   - Verifies that the function logs information about the number of stuck emails/batches found and processed.

