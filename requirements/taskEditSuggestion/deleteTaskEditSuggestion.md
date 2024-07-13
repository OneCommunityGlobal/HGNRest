Check mark: ✅
Cross Mark: ❌

# Delete Task Edit Suggestions

> ## Positive case

1. ✅ Receives a Delete request in the **/api/taskeditsuggestion** route
2. ✅ Returns 200 if deleteOne on taskEditSuggestion is successfull

> ## Negative case

1. ✅ Returns error 404 if the API does not exist
2. ✅ Returns 400 if any error occurs during delete

> ## Edge case