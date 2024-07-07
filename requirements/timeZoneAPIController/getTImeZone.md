Check mark: ✅
Cross Mark: ❌

# Get Time Zone

> ## Positive case

1. ❌ Returns status code 200 and response data as follows: 
    i.  current location 
    ii. timezone

> ## Negative case

1. ✅ Returns status code 403, if the user is not authorised.
2. ✅ Returns status code 401, if the API key is missing.
3. ✅ Returns status code 400, if the location is missing.
4. ❌ Returns status code 404, if geocodeAPIEndpoint returns no results.
5. ❌ Returns status code 500, if any other error occurs.

> ## Edge case
