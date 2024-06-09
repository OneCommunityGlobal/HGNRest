Check mark: ✅
Cross Mark: ❌

# Delete Time Off Request By Id

> ## Positive case

1. ❌ Returns 200 if the timeOffRequest is successfully updated

> ## Negative case

1. ✅ Returns 403 if the delete request is made my a user for whom all of the below cases are true:
    a. User does not have the role of Owner nor of Administrator.
    b. User does not have the 'manageTimeOffRequests' permission.

2. ❌ Returns 400 is request body is contains one of the following parameters incorrect:
    a. duration 
    b. reason
    c. startingDate
    d. requestId

3. ❌ Returns 404 if no timeOffRequest is found matching the requestId

4. ❌ Returns 500 if any error occurs

> ## Edge case
