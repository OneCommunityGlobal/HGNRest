Check mark: ✅
Cross Mark: ❌

# createPopPopupEditor Function

> ### Positive case

> 1. ✅ Should return 201 and the new pop-up editor on success

> ### Negative case

> 1. ✅ Should return 403 if user does not have permission to create a pop-up editor
> 2. ✅ Should return 400 if the request body is missing required fields
> 3. ✅ Should return 500 if there is an error saving the new pop-up editor to the database
