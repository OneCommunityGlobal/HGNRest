Check mark: ✅
Cross Mark: ❌

# postReason

> ## Positive case
1. ❌ Receives a POST request in the **/api/reason/** route.
2. ❌ Return 200 if schedule reason and send blue sqaure email successfully.

> ## Negative case
1. ✅ Returns 400 for warning to choose Sunday. 
2. ✅ Returns 400 for warning to choose a funture date. 
3. ✅ Returns 400 for not providing reason. 
4. ✅ Returns 404 when error in finding user Id. 
5. ❌ Returns 403 when duplicate reason to the date.
6. ❌ Returns 400 when any error in saving.

> ## Edge case