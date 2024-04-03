
# Team Controller

The Team Controller manages team - related operations, including creating, retrieving, updating, and deleting team information.The cases are categorized into positive, negative, and edge cases for clarity and test prioritization.

## Functionalities

### GetAllTeams

#### Negative Cases
    - ❌ Returns a status of 404 with an error message if there's an error during retrieval.

#### Positive Cases
    - ✅ Returns a status of 200 with team data on success.

### GetTeamById

#### Negative Cases
    - ❌ Returns a status of 404 with an error message if the team does not exist or an error occurs.

#### Positive Cases
    - ✅ Retrieves a specific team by its ID.
- ✅ Returns a status of 200 with team data if the team exists.

### PostTeam

#### Negative Cases
    - ❌ Returns a status of 403 if the requestor does not have the necessary permission.
- ❌ Returns a status of 403 with an error message if a team with the same name already exists.
- ❌ Returns a status of 404 with an error message if there's an error during the save operation.

#### Positive Cases
    - ✅ Creates a new team if the requestor has `postTeam` permission and the team name does not already exist.
- ✅ Returns a status of 200 with the created team data on success.


