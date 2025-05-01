Check mark: ✅
Cross Mark: ❌

# Add Information

> ## Positive case
1. ✅ Returns 201 if adding new information successfullyn and no cache.
2. ✅ Returns if adding new information successfully and hascache.

> ## Negative case
1. ✅ Returns error 500 if if there are no information in the database and any error occurs when finding the infoName.
2. ✅ Returns error 400 if if there are duplicate infoName in the database.
3. ✅ Returns error 400 if if there are issues when saving new informations.
4. ✅ Returns error 400 if if there are errors when saving the new information.

> ## Edge case