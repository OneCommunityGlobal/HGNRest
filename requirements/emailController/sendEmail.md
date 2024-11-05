# Send Email Function

## Negative Cases

1. ❌ **Returns error 400 if `to`, `subject`, or `html` fields are missing from the request**
2. ❌ **Returns error 500 if there is an internal error while sending the email**

## Positive Cases

1. ✅ **Returns status 200 when email is successfully sent with `to`, `subject`, and `html` fields provided**
