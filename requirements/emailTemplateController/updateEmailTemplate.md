# Update Email Template Function

## Negative Cases

1. ❌ **Returns error 401 if `requestor` is missing from the request**
   - Ensures that the function checks for the presence of `requestor.requestorId` in the request body and responds with a `401` status code if it's missing.

2. ❌ **Returns error 403 if user doesn't have `sendEmails` permission**
   - Verifies that the function checks user permissions and responds with a `403` status code if the user is not authorized to update email templates.

3. ❌ **Returns error 400 if template ID is invalid**
   - Ensures that the function validates the template ID is a valid MongoDB ObjectId format.

4. ❌ **Returns error 404 if template is not found**
   - Verifies that the function handles cases where no template exists with the provided ID and responds with a `404` status code.

5. ❌ **Returns error 400 if template name is invalid or empty**
   - Verifies that if `name` is provided in the update, it is a non-empty string and meets validation requirements.

6. ❌ **Returns error 400 if template subject is invalid or empty**
   - Ensures that if `subject` is provided in the update, it is a non-empty string and meets validation requirements.

7. ❌ **Returns error 400 if template HTML content is invalid or empty**
   - Verifies that if `html_content` is provided in the update, it is a non-empty string and meets validation requirements.

8. ❌ **Returns error 400 if template variables are invalid**
   - Ensures that if `variables` are provided, they follow the correct structure and types as defined in `EMAIL_CONFIG.TEMPLATE_VARIABLE_TYPES`.

9. ❌ **Returns error 409 if template name already exists (when updating name)**
   - Verifies that if the template name is being changed, the function checks for duplicate names (case-insensitive) and responds with a `409` status code if a template with the new name already exists.

10. ❌ **Returns error 500 if there is an internal error while updating the template**
    - Covers scenarios where there are database errors or service failures while updating the email template.

11. ❌ **Returns validation errors in response if template data is invalid**
    - Ensures that if template validation fails, the response includes an `errors` array with specific validation error messages.

## Positive Cases

1. ✅ **Returns status 200 when email template is successfully updated**
   - Ensures that the function successfully updates the email template and returns the updated template with a `200` status code.

2. ✅ **Updates template with correct updater information**
   - Verifies that the `updated_by` field is set to the requestor's user ID.

3. ✅ **Updates only provided fields (partial update support)**
   - Ensures that only the fields provided in the request body are updated, leaving other fields unchanged.

4. ✅ **Trims and normalizes updated template fields**
   - Verifies that updated `name` and `subject` are trimmed of whitespace before storage.

5. ❌ **Returns updated template with all fields**
   - Ensures that the response includes the complete updated template object with all fields, timestamps, and creator/updater information.

