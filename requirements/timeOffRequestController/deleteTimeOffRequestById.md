Check mark: ✅
Cross Mark: ❌

# Delete Time Off Request By Id

> ## Positive case

1. ✅ Returns 200 on successfully deleting the request.

> ## Negative case

1. ✅ Returns 403 if the delete request is made my a user for whom all of the below cases are true:
    a. User does not have the role of Owner nor of Administrator.
    b. User is attempting to delete someone else's timeOffRequest. 
    c. User does not have the 'manageTimeOffRequests' permission.

2. ✅ Returns 404 if the timeOffRequest is not found.

3. ✅ Returns 500 if the some any occured while deleting or checking for permission or any other case.

> ## Edge case
