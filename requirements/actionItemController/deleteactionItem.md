Check mark: ✅
Cross Mark: ❌

# Get Action Item

> ## Positive case

1. ❌ Receives a POST request in the **/api/userProfile** route
2. ✅ Returns 200 if get actionItem successfully finds and removes the matching `ActionItem`

   > ## Negative case

3. ❌ Returns error 404 if the API does not exist
4. ✅ Returns 400 if any error occurs when finding an `ActionItem`.
5. ✅ Returns 400 if no `ActionItem` is found
6. ✅ Returns 400 if any error occurs when deleting an `ActionItem`.

> ## Edge case

1.  ✅ Returns 400 if notificationdeleted method throws an error.
