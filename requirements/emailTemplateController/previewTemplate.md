# Preview Email Template Function

## Negative Cases

1. ❌ **Returns error 401 if `requestor` is missing from the request**
   - Ensures that the function checks for the presence of `requestor.requestorId` or `user.userid` in the request body/user object and responds with a `401` status code if both are missing.

2. ❌ **Returns error 403 if user doesn't have `sendEmails` permission**
   - Verifies that the function checks user permissions and responds with a `403` status code if the user is not authorized to preview email templates.

3. ❌ **Returns error 400 if template ID is invalid**
   - Ensures that the function validates the template ID is a valid MongoDB ObjectId format.

4. ❌ **Returns error 404 if template is not found**
   - Verifies that the function handles cases where no template exists with the provided ID and responds with a `404` status code.

5. ❌ **Returns error 400 if provided variables are invalid**
   - Ensures that the function validates provided variables match the template's variable definitions in type and required fields.

6. ❌ **Returns error 400 if required variables are missing**
   - Verifies that all required variables for the template are provided in the request body.

7. ❌ **Returns error 500 if there is an internal error while rendering the template**
   - Covers scenarios where there are errors during template rendering (e.g., invalid template syntax, variable replacement errors).

## Positive Cases

1. ✅ **Returns status 200 with rendered template preview**
   - Ensures that the function successfully renders the template with the provided variables and returns the rendered `subject` and `html_content`.

2. ✅ **Replaces all template variables correctly**
   - Verifies that all variables in the template are replaced with the provided values in both `subject` and `html_content`.

3. ✅ **Validates variables before rendering**
   - Ensures that the function validates all provided variables match the template's variable definitions before attempting to render.

4. ✅ **Does not sanitize content for preview**
   - Verifies that the preview is rendered without sanitization to allow full preview of the final email content.

5. ✅ **Returns both subject and content in preview**
   - Ensures that the response includes both the rendered `subject` and `html_content` (or `content`) in the preview object.

6. ❌ **Handles missing optional variables gracefully**
   - Verifies that if optional variables are not provided, they are handled appropriately (not replaced or replaced with empty strings).

