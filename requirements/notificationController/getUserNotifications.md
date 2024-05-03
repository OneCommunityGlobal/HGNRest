# GET User Notifications

## Positive Cases

1. ✅ Returns status 200 with notification data when a valid userId is provided by an Administrator or Owner querying another user's notifications.

## Negative Cases

1. ✅ Returns error 403 if userId does not match requestorId.
2. ✅ Returns error 400 if the userId is missing from the request.
3. ❌ Returns error 500 if there is an internal error while fetching notifications.
