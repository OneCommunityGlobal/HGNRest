# Get All Email Templates Function

## Negative Cases

1. ❌ **Returns error 401 if `requestor` is missing from the request**
   - Ensures that the function checks for the presence of `requestor.requestorId` or `user.userid` in the request body/user object and responds with a `401` status code if both are missing.

2. ❌ **Returns error 403 if user doesn't have `sendEmails` permission**
   - Verifies that the function checks user permissions and responds with a `403` status code if the user is not authorized to view email templates.

3. ❌ **Returns error 500 if there is an internal error while fetching templates**
   - Covers scenarios where there are database errors or service failures while fetching email templates.

## Positive Cases

1. ✅ **Returns status 200 with all email templates**
   - Ensures that the function successfully fetches all email templates from the database and returns them with populated creator/updater information.

2. ✅ **Supports search functionality by template name**
   - Verifies that the function filters templates by name when a `search` query parameter is provided (case-insensitive search).

3. ✅ **Supports sorting by specified field**
   - Ensures that templates can be sorted by any specified field via the `sortBy` query parameter, defaulting to `created_at` descending if not specified.

4. ✅ **Supports optional content projection**
   - Verifies that when `includeEmailContent` is set to `'true'`, the response includes `subject`, `html_content`, and `variables` fields. When not included, only basic metadata is returned.

5. ✅ **Returns templates with populated creator and updater information**
   - Ensures that `created_by` and `updated_by` fields are populated with user profile information (firstName, lastName, email).

6. ❌ **Handles empty search results gracefully**
   - Verifies that if no templates match the search criteria, the function returns an empty array without error.

