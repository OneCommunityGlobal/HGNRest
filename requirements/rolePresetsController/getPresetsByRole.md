Check mark: ✅
Cross Mark: ❌

# getPresetsByRole 

> ## Positive case
1. ✅ Receives a GET request in the **/api/rolePreset** route
1. ✅ Return 200 if get Presets by roleName successfully.

> ## Negative case

1. ✅ Returns error 404 if the API does not exist
2. ✅ Returns error 403 if user doesn't have permissions for putRole
3. ✅ Returns 404 if any error when finding by id
4. ✅ Returns 400 when catching any error in finding roleName 

> ## Edge case