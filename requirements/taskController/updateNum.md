Check mark: ✅
Cross Mark: ❌

# updateNum Function

> ## Positive case
1. ✅ Returns status 200 on successfully updating.

> ## Negative case
1. ✅ Returns status 400 if either request.body.nums is missing or some error occurs while saving child task.

2. ✅ Returns status 403 if request.body.requestor is missing `updateNum` permission.

3. ✅ Returns status 404 if some error occurs while processing the child tasks.

> ## Edge case
