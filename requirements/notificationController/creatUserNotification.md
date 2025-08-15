Check mark: ✅
Cross Mark: ❌


# Create User Notification

## Negative Cases

1. ✅ Returns error 403 if requestor role is not Admin or Owner
2. ✅ Returns error 400 if message and recipient are missing from request
3. ✅ Returns error 500 if there is an internal error while fetching unread notifications.

## Positive Cases

1. ✅ Returns status 200 when notification is successfully created with sender, recipient and message
