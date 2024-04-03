Check mark: ✅
Cross Mark: ❌

# Team Controller

The Team Controller manages team-related operations, including creating, retrieving, updating, and deleting team information. Below are the various cases handled by the controller.


## Functionalities

### GetAllTeams
- ✅ Retrieves all teams, sorted by team name.
- ✅ Returns a status of 200 with team data on success.
- ❌ Returns a status of 404 with an error message if there's an error during retrieval.

### GetTeamById
- ✅ Retrieves a specific team by its ID.
- ✅ Returns a status of 200 with team data if the team exists.
- ❌ Returns a status of 404 with an error message if the team does not exist or an error occurs.

### PostTeam
- ✅ Creates a new team if the requestor has `postTeam` permission and the team name does not already exist.
- ✅ Returns a status of 200 with the created team data on success.
- ❌ Returns a status of 403 if the requestor does not have the necessary permission.
- ❌ Returns a status of 403 with an error message if a team with the same name already exists.
- ❌ Returns a status of 404 with an error message if there's an error during the save operation.


