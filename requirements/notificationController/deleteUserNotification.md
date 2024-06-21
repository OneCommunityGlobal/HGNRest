Check mark: ✅
Cross Mark: ❌


# Delete User Notification

## Negative Cases

1. ✅ Returns error 403 if requestor role is not Admin or Owner.
2. ✅ Returns error 500 if there is an internal error while deleting notification.

## Positive Cases

1. ✅ Returns status 200 when notification is successfully deleted.
