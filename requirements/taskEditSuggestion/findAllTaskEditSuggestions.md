Check mark: ✅
Cross Mark: ❌

# find all task edit suggestions

> ## Positive case

1. ✅ Receives a GET request in the **/api/taskeditsuggestion** route
2. ✅ Check if userId provided corresponds to a userPorfile in the database
3. ✅ Check if wbsId of the oldTask provided corresponds to a wbsProject in the database
4. ✅ Return userProfiles if projectId of the recevied wbsProject is present in userProfiles 
5. ✅ Returns 200 if findOneAndUpdate is successfull

> ## Negative case

1. ✅ Returns error 404 if the API does not exist
2. ✅ Returns 400 if userId provided does not corresponds to a userPorfile in the database
3. ✅ Returns 400 if wbsId of the oldTask provided does not corresponds to a wbsProject in the database
4. ✅ Returns 400 if userProfile find fails
5. ✅ Returns 400 if TaskEditSuggestion findOneAndUpdate fails

> ## Edge case