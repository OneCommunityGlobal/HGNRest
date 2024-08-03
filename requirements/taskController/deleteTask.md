Check mark: ✅
Cross Mark: ❌

# deleteTask Function

> ## Positive case
1. ❌ Returns status 200 on successful deletion.

> ## Negative case
1. ❌ Returns status 400 if either no record is found in Task collection or some error occurs while saving the tasks.

2. ❌ Returns status 403 if the request.body.requestor does not have `deleteTask` permission.


> ## Edge case
