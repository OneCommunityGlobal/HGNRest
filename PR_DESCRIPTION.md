# Description

This PR adds a `reasons` array to infringements in the user profile, allowing for more robust and flexible categorization of issues such as "time not met," "missing summary," "missed video call," "late reporting," or "other."

The controller logic ensures reasons are consistently handled as a lowercased, deduplicated array with a safe default, which both improves data quality and simplifies future analytics or display logic.

**Fixes #1686, #1817** (PRIORITY HIGH)

## Related PRS (if any):
[PR 1686](https://github.com/OneCommunityGlobal/HGNRest/pull/1686) - Original PR by Yu Yan taking over for Ujjwal  
[PR 1817](https://github.com/OneCommunityGlobal/HGNRest/pull/1817) - Attempt to resolve merge conflicts

## Main changes explained:

Added functionality to easily parse reasons for Blue Squares using a reasons array. Added the reasons array field to store multiple categorization reasons for each infringement.

- Added `reasons` field under `infringements` in `userProfile` model with predefined options (which can be modified as required)
  - Type: Array of Strings
  - Default: `['other']`
  - Enum values: `'time not met'`, `'missing summary'`, `'missed video call'`, `'late reporting'`, `'other'`
  
- Updated `addInfringements` controller logic to:
  - Accept reasons array from request body
  - Normalize values to lowercase
  - Remove duplicates
  - Filter valid enum values only
  - Default to `['other']` if empty or invalid
  
- Maintains backward compatibility with existing `reason` (single string) field

## How to test:

1. Check out the current branch: `feat/infringement-reasons-array`
2. Run `npm run build` and `npm start` to run this PR locally
3. Send a POST request to `api/userProfile/:userId/addInfringement` to add an infringement

**Example request body:**
```json
{
  "requestor": "<your-user-id>",
  "blueSquare": {
    "date": "2025-09-03",
    "description": "PR Testing Add Infringement",
    "reasons": ["time not met", "missing summary", "missed video call", "late reporting", "other"]
  }
}
```

**Valid reasons values:**
- `'time not met'`
- `'missing summary'`
- `'missed video call'`
- `'late reporting'`
- `'other'` (default)

4. Verify in the database that the infringement was added with the reasons array properly stored

## Screenshots or videos of changes:

### API Test (Postman/Insomnia):
```
POST http://localhost:4500/api/userProfile/68acd7da7787ad0055d8517b/addInfringement

Body:
{
  "requestor":"68acd7da7787ad0055d8517b",
  "blueSquare": {
    "date":"2025-09-03",
    "description":"PR Testing Add Infringement",
    "reasons":["time not met", "missing summary", "missed video call", "late reporting", "other"]
  }
}

Response: 200 OK
{
  "_id": "68acd7da7787ad0055d8517b"
}
```

### Database Verification:
The `infringements` array in the user profile document should now contain:
```json
{
  "infringements": [
    {
      "date": "2025-09-03",
      "description": "PR Testing Add Infringement",
      "reasons": [
        "time not met",
        "missing summary",
        "missed video call",
        "late reporting",
        "other"
      ],
      "_id": "68b8d5b874bbf9895405cf40"
    }
  ]
}
```

## Notes:

- This PR resolves the merge conflicts from the original PRs #1686 and #1817
- All existing fields in the user profile model are preserved
- The new `reasons` array field is backward compatible - existing infringements without reasons will default to `['other']`
