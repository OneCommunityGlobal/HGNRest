# Get Email Template By ID Function

## Negative Cases

1. ❌ **Returns error 401 if `requestor` is missing from the request**
   - Ensures that the function checks for the presence of `requestor.requestorId` or `user.userid` in the request body/user object and responds with a `401` status code if both are missing.

2. ❌ **Returns error 403 if user doesn't have `sendEmails` permission**
   - Verifies that the function checks user permissions and responds with a `403` status code if the user is not authorized to view email templates.

3. ❌ **Returns error 400 if template ID is invalid**
   - Ensures that the function validates the template ID is a valid MongoDB ObjectId format.

4. ❌ **Returns error 404 if template is not found**
   - Verifies that the function handles cases where no template exists with the provided ID and responds with a `404` status code.

5. ❌ **Returns error 500 if there is an internal error while fetching the template**
   - Covers scenarios where there are database errors or service failures while fetching the email template.

## Positive Cases

1. ✅ **Returns status 200 with the requested email template**
   - Ensures that the function successfully fetches the email template with the provided ID and returns all template details.

2. ✅ **Returns template with populated creator and updater information**
   - Verifies that `created_by` and `updated_by` fields are populated with user profile information (firstName, lastName, email).

3. ✅ **Returns complete template data including variables**
   - Ensures that the response includes all template fields: `name`, `subject`, `html_content`, `variables`, `created_by`, `updated_by`, and timestamps.

