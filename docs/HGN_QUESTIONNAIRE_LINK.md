# HGN Questionnaire – Permanent Link

## The link

```
https://highestgood.com/questionnaire
```

This link never changes. Administrators can share the same link with every eligible person.

## Who can open it

The questionnaire opens only for a person who:

1. Has an account in the HGN app (they log in first; the link brings them back to the questionnaire after login), **and**
2. Was set up and invited through the **HGN Dropbox process**: User Profile → Access Management → Dropbox → Invite, **and**
3. Has an active account.

The link becomes active for that person as soon as the Dropbox invite is sent. If their Dropbox access is
revoked, or their account is deactivated, the link stops working for them. Owners can always open it to
preview the questionnaire.

Everyone else sees a message saying the questionnaire is available only after the Dropbox setup and invite.

## Onboarding steps for administrators

1. Create the person's account in the HGN app, the same way as today.
2. Open their profile → **Access Management** → **Dropbox**, choose the team folder and click **Invite**.
3. Send them the permanent link: `https://highestgood.com/questionnaire`.
   - To copy it, use **Copy questionnaire link** on the Dropbox row in Access Management (shown once the
     invite is sent), or the same button on the HGN Help → Community Members dashboard.

## API

`GET /api/hgnform/access` (authenticated) checks whether the logged-in user can open the questionnaire.

```json
{ "eligible": true, "reason": null, "invitedOn": "2026-10-23T00:00:00.000Z" }
{ "eligible": false, "reason": "NOT_INVITED" }
```

`reason` is one of `NOT_LOGGED_IN`, `USER_NOT_FOUND`, `INACTIVE`, `NOT_INVITED` or `ACCESS_REVOKED`.

`POST /api/hgnform` (submitting the questionnaire) applies the same check. It returns `403` when the user
is not eligible, or when a non-Owner submits a response for another user.

The check lives in `src/helpers/questionnaireAccessHelper.js`. It reads the `applicationAccess` record that
the Dropbox invite (`POST /api/dropbox/create-folder-and-invite`) writes, and requires an entry with
`app: 'dropbox'` and `status: 'invited'`.
