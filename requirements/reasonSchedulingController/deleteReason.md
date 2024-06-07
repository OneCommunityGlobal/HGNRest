Check mark: ✅
Cross Mark: ❌

# deleteReason

> ## Positive case
<!-- 1. ❌ Receives a POST request in the **/api/backup/popupeditors/** route. -->
2. ❌ Return 200 if delete reason successfully.

> ## Negative case
1. ❌ Returns 403 when no permission to delete
2. ❌ Returns 404 when error in finding user Id. 
3. ❌ Returns 404 when error in finding reason. 
4. ❌ Returns 500 when error in deleting.

> ## Edge case