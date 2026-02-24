# Create Email Template Function

## Negative Cases

1. ❌ **Returns error 401 if `requestor` is missing from the request**
   - Ensures that the function checks for the presence of `requestor.requestorId` in the request body and responds with a `401` status code if it's missing.

2. ❌ **Returns error 403 if user doesn't have `sendEmails` permission**
   - Verifies that the function checks user permissions and responds with a `403` status code if the user is not authorized to create email templates.

3. ❌ **Returns error 400 if required fields are missing**
   - Ensures that required fields (`name`, `subject`, `html_content`) are present in the request body.

4. ❌ **Returns error 400 if template name is invalid or empty**
   - Verifies that the template name is a non-empty string and meets validation requirements.

5. ❌ **Returns error 400 if template subject is invalid or empty**
   - Ensures that the template subject is a non-empty string and meets validation requirements.

6. ❌ **Returns error 400 if template HTML content is invalid or empty**
   - Verifies that the template HTML content is a non-empty string and meets validation requirements.

7. ❌ **Returns error 400 if template variables are invalid**
   - Ensures that if `variables` are provided, they follow the correct structure and types as defined in `EMAIL_CONFIG.TEMPLATE_VARIABLE_TYPES`.

8. ❌ **Returns error 409 if template name already exists**
   - Verifies that the function checks for duplicate template names (case-insensitive) and responds with a `409` status code if a template with the same name already exists.

9. ❌ **Returns error 500 if there is an internal error while creating the template**
   - Covers scenarios where there are database errors or service failures while creating the email template.

10. ❌ **Returns validation errors in response if template data is invalid**
    - Ensures that if template validation fails, the response includes an `errors` array with specific validation error messages.

## Positive Cases

1. ✅ **Returns status 201 when email template is successfully created**
   - Ensures that the function successfully creates a new email template and returns it with a `201` status code.

2. ✅ **Creates template with correct creator information**
   - Verifies that the `created_by` and `updated_by` fields are set to the requestor's user ID.

3. ✅ **Stores template variables correctly**
   - Ensures that if `variables` are provided, they are stored correctly with proper structure and validation.

4. ✅ **Trims and normalizes template fields**
   - Verifies that template `name` and `subject` are trimmed of whitespace before storage.

5. ❌ **Returns created template with all fields**
   - Ensures that the response includes the complete template object with all fields, timestamps, and creator information.

