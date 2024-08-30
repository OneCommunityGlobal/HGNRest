Check mark: ✅
Cross Mark: ❌

# patchReason

> ## Positive case
1. ✅ Receives a POST request in the **/api/breason/** route.
2. ✅ Return 200 if updated schedule reason and send blue sqaure email successfully.

> ## Negative case
1. ✅ Returns 400 for not providing reason. 
2. ✅ Returns 404 when error in finding user Id. 
3. ✅ Returns 404 when not finding provided reason.
4. ✅ Returns 400 when any error in saving. 

> ## Edge case