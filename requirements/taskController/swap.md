Check mark: ✅
Cross Mark: ❌

# swap Function

> ## Positive case
1. ✅ Returns status 201 on successfully updating.

> ## Negative case
1. ✅ Returns status 400 if either request.body.taskId1 is missing or request.body.taskId2 is missing or there is error while executing findById in Task or some error occurs while saving task.

2. ✅ Returns status 403 if request.body.requestor is missing `swapTask` permission.

3. ✅ Returns status 404 if some error occurs while executing find operation on Task collection.

> ## Edge case
