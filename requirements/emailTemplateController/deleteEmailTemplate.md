# Delete Email Template Function

## Negative Cases

1. ❌ **Returns error 401 if `requestor` is missing from the request**
   - Ensures that the function checks for the presence of `requestor.requestorId` in the request body and responds with a `401` status code if it's missing.

2. ❌ **Returns error 403 if user doesn't have `sendEmails` permission**
   - Verifies that the function checks user permissions and responds with a `403` status code if the user is not authorized to delete email templates.

3. ❌ **Returns error 400 if template ID is invalid**
   - Ensures that the function validates the template ID is a valid MongoDB ObjectId format.

4. ❌ **Returns error 404 if template is not found**
   - Verifies that the function handles cases where no template exists with the provided ID and responds with a `404` status code.

5. ❌ **Returns error 500 if there is an internal error while deleting the template**
   - Covers scenarios where there are database errors or service failures while deleting the email template.

## Positive Cases

1. ✅ **Returns status 200 when email template is successfully deleted**
   - Ensures that the function successfully deletes the email template and returns a success message with a `200` status code.

2. ✅ **Performs hard delete (permanently removes template)**
   - Verifies that the template is permanently removed from the database, not just marked as deleted.

3. ✅ **Records deleter information before deletion**
   - Ensures that the `updated_by` field is set to the requestor's user ID before deletion (if applicable).

4. ❌ **Handles deletion gracefully (no error if already deleted)**
   - Verifies that if the template is already deleted or doesn't exist, the function handles it gracefully without error.

