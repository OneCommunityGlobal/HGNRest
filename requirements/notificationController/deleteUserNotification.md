Check mark: ✅
Cross Mark: ❌


# Delete User Notifications

## Negative case

1. ✅ Returns a 400 status error if the provided notification ID is not valid.
2. ✅ Returns a 400 status error if no notification is found with the provided ID.
3. ✅ Returns a  403 status error with a message if the requestor’s ID does not match the recipient ID.
4. ✅ Returns a  400 status error if an error occurs during the `.remove()` operation.

## Positive case

1. ✅ Returns a 200 status code with a success message when notification is successfully deleted.
