Check mark: ✅
Cross Mark: ❌

# createPopupEditorBackup 

> ## Positive case
1. ✅ Receives a POST request in the **/api/backup/popupeditors/** route.
2. ✅ Return 201 if create new popup successfully.

> ## Negative case
1. ✅ Returns 403 when no permission. 
2. ✅ Returns 400 when missing popupName, popupContent. 
3. ✅ Returns 500 when any error in saving. 

> ## Edge case