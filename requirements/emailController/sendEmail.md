# Send Email Function

## Negative Cases

1. ❌ **Returns error 401 if `requestor` is missing from the request**
   - Ensures that the function checks for the presence of `requestor.requestorId` in the request body and responds with a `401` status code if it's missing.

2. ❌ **Returns error 403 if user doesn't have `sendEmails` permission**
   - Verifies that the function checks user permissions and responds with a `403` status code if the user is not authorized to send emails.

3. ❌ **Returns error 400 if `to`, `subject`, or `html` fields are missing from the request**
   - Ensures that all required fields (`to`, `subject`, `html`) are present in the request body.

4. ❌ **Returns error 400 if email contains unreplaced template variables**
   - Verifies that the function validates that all template variables in `subject` and `html` have been replaced before sending.

5. ❌ **Returns error 404 if requestor user is not found**
   - Ensures that the function validates the requestor exists in the userProfile collection.

6. ❌ **Returns error 400 if recipient count exceeds maximum limit (2000)**
   - Verifies that the function enforces the maximum recipients per request limit for specific recipient requests.

7. ❌ **Returns error 400 if any recipient email is invalid**
   - Ensures that all recipient email addresses are validated before creating batches.

8. ❌ **Returns error 500 if there is an internal error during email creation**
   - Covers scenarios where there are database errors or service failures during email/batch creation.

## Positive Cases

1. ✅ **Returns status 200 when email is successfully created with valid recipients**
   - Ensures that the function creates the parent Email document and EmailBatch items in a transaction, queues the email for processing, and returns success.

2. ✅ **Enforces recipient limit for specific recipient requests**
   - Verifies that the maximum recipient limit (2000) is enforced when sending to specific recipients.

3. ✅ **Creates email batches correctly**
   - Ensures that recipients are properly normalized, validated, and chunked into EmailBatch items according to the configured batch size.

4. ✅ **Validates all template variables are replaced**
   - Verifies that the function checks both HTML content and subject for unreplaced template variables before allowing email creation.

5. ❌ **Handles transaction rollback on errors**
   - Ensures that if any part of email/batch creation fails, the entire transaction is rolled back.
