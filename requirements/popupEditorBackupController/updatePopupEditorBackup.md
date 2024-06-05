Check mark: ✅
Cross Mark: ❌

# updatePopupEditorBackup

> ## Positive case
1. ❌ Receives a POST request in the **/backup/popupeditors/** route.
2. ✅ Return 201 if find popup and update popup successfully.
3. ✅ Return 201 if no find and update popup successfully.

> ## Negative case
1. ✅ Returns 403 when no permission. 
2. ✅ Returns 400 when missing popupName, popupContent. 
3. ✅ Returns 500 when any error in finding. 
4. ✅ Returns 500 when any error in saving. 

> ## Edge case