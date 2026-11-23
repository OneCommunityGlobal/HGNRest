# Badge assignment API

Use these endpoints from the **Badge Management → Badge Assignment** UI.

## Authentication

- Send **Authorization** header with a valid JWT.
- The backend sets `requestor` on `req.body` from the token (you do not need to send it in the body).

---

## Option 1: Single user (one request per user)

**PUT** `/api/badge/assign/:userId`

- **URL:** Replace `:userId` with one user’s MongoDB ObjectId (e.g. `PUT /api/badge/assign/507f1f77bcf86cd799439011`).
- **Body (JSON):**
  ```json
  {
    "badgeCollection": [
      { "badge": "<badgeId>", "count": 1, "featured": false }
    ]
  }
  ```
- **Success:** 201, body = user profile id.
- **Errors:** 400 (bad request), 403 (forbidden), 500 (server error). Response body is a string message.

To assign to **multiple users**, call this endpoint **once per user** with the same `badgeCollection`.

---

## Option 2: Bulk (multiple users in one request)

**POST** `/api/badge/assign/bulk`

- **Body (JSON):**
  ```json
  {
    "userIds": ["<userId1>", "<userId2>"],
    "badgeCollection": [
      { "badge": "<badgeId>", "count": 1, "featured": false }
    ]
  }
  ```
- **Success:** 201, body = `{ "assigned": ["id1", "id2"], "failed": [] }`.
- **Errors:** 400/403/500 with JSON `{ "error": "..." }`. Partial success still returns 201 with `assigned` and `failed` arrays.

Use this when the UI sends **one request** with multiple selected users.

---

## Frontend checklist

1. **URL**
   - Single: `PUT /api/badge/assign/{userId}` (one call per user).
   - Bulk: `POST /api/badge/assign/bulk` with `userIds` and `badgeCollection` in the body.

2. **Headers**
   - `Authorization: <JWT>`
   - `Content-Type: application/json`

3. **Body**
   - Always send `badgeCollection` as an array of `{ badge, count, ... }`.
   - For bulk, also send `userIds` as an array of user id strings.

4. **Error handling**
   - Do not show a generic “Oops” for every failure. Use the **response status** and **response body** (string or `error` field) to show a specific message (e.g. “User not found”, “Badge collection is required”).

---

## Debugging

- Restart the backend after code changes.
- In the **server console** you should see lines like:
  - `[Badge Assign] PUT /badge/assign called. userId=...`
  - or `[Badge Assign Bulk] POST /badge/assign/bulk called. userIds=...`
- If you never see these when clicking Assign, the request is not reaching this API (check frontend URL and Network tab).
- In the browser **Network** tab, inspect the failing request: URL, method, request payload, and response status/body.
