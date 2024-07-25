Check mark: ✅
Cross Mark: ❌

# Get Time Off Requests

> ## Positive case

1. ✅ Returns status code 201, if the new time-off request is saved successfully.

> ## Negative case

1. ✅ Return status code 403, if the user is not authorized to set time-off request.
2. ✅ Return status code 400, if the request is missing any of the following parameters:
        a. duration
        b. startingDate
        c. reason
        d. requestFor
3. ✅ Return status code 500, if any error occurs while setting the time-off request.

> ## Edge case
