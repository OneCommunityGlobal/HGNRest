Check mark: ✅
Cross Mark: ❌

# ForcePwd

> ## Negative Cases

1. ✅ Returns a `400 Bad Request` status if userId is not valid with an error message "Bad Request".
2. ✅ Returns a `500 Internal Error` status with the error details if finding userProfile fails.
3. ✅ Returns a `500 Internal Error` status with the error details if new password fails to save.

> ## Positive Cases

1. ✅ Returns a `200 OK` status with a success message "password Reset".
