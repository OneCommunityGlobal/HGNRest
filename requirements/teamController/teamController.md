
Check mark: ✅
Cross Mark: ❌

# Team Controller Test Documentation

## GetAllTeams

> ### Negative Cases
1. ✅ **Returns 404 - an error occurs during team retrieval.**
   
> ### Positive Cases
1. ✅ **Returns 200 - should return all teams sorted by name.**


## GetTeamById

> ### Negative Cases
1. ✅ **Returns 404 - the specified team ID does not exist.**
   
> ### Positive Cases
1. ✅ **Returns 200 - all is successful, return a team by ID.**


## PostTeam

> ### Negative Cases
1. ❌ **Returns 403 - the requestor lacks `postTeam` permission.**
2. ❌ **Returns 403 - a team with the same name already exists.**
   
> ### Positive Cases
1. ❌ **Returns 200 - a new team is successfully created.**




