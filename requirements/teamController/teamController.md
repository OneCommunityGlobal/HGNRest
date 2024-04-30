Check mark: ✅
Cross Mark: ❌

# Team Controller Test Documentation

## PostTeam

> ### Negative Cases
1. ✅ **Returns 403 - the requestor lacks `postTeam` permission.**
2. ✅ **Returns 403 - a team with the same name already exists.**

> ### Positive Cases
1. ✅ **Returns 200 - a new team is successfully created.**