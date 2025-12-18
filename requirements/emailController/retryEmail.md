# Retry Email Function

## Negative Cases

1. ❌ **Returns error 401 if `requestor` is missing from the request**
   - Ensures that the function checks for the presence of `requestor.requestorId` in the request body and responds with a `401` status code if it's missing.

2. ❌ **Returns error 403 if user doesn't have `sendEmails` permission**
   - Verifies that the function checks user permissions and responds with a `403` status code if the user is not authorized to retry emails.

3. ❌ **Returns error 400 if `emailId` parameter is missing or invalid**
   - Ensures that the function validates `emailId` from `req.params` is a valid MongoDB ObjectId.

4. ❌ **Returns error 404 if the email is not found**
   - Verifies that the function handles cases where the email with the provided `emailId` doesn't exist.

5. ❌ **Returns error 400 if email is not in a retryable status**
   - Ensures that the function only allows retry for emails in `FAILED` or `PROCESSED` status. Returns `400` for other statuses.

6. ❌ **Returns error 500 if there is an internal error while fetching failed batches**
   - Covers scenarios where there are database errors while querying for failed EmailBatch items.

7. ❌ **Returns error 500 if there is an internal error while resetting email status**
   - Covers scenarios where there are database errors while updating the email status to PENDING.

8. ❌ **Returns error 500 if there is an internal error while resetting batches**
   - Covers scenarios where there are database errors while resetting individual EmailBatch items to PENDING.

## Positive Cases

1. ✅ **Returns status 200 when email is successfully retried with failed batches**
   - Ensures that the function marks the parent Email as PENDING, resets all failed EmailBatch items to PENDING, queues the email for processing, and returns success with the count of failed items retried.

2. ✅ **Returns status 200 when email has no failed batches**
   - Verifies that if an email has no failed EmailBatch items, the function returns success with `failedItemsRetried: 0` without error.

3. ✅ **Correctly resets only failed EmailBatch items**
   - Ensures that only EmailBatch items with `FAILED` status are reset to PENDING for retry.

4. ✅ **Marks parent email as PENDING**
   - Verifies that the parent Email status is changed to PENDING, allowing it to be reprocessed.

5. ✅ **Queues email for processing after reset**
   - Ensures that after resetting the email and batches, the email is added to the processing queue.

6. ✅ **Returns correct data in response**
   - Verifies that the response includes `emailId` and `failedItemsRetried` count in the data field.

7. ❌ **Handles concurrent retry requests gracefully**
   - Ensures that if multiple retry requests are made simultaneously, the function handles race conditions appropriately.

