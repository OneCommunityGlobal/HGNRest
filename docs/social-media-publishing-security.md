# Task 1551: backend-only social-media publishing credentials

Original assignment: [Phase I task document](https://docs.google.com/document/d/1lZYJGWGjv8GQxU6nuIWbhIbBmy8S_GNqnJbT_RKD110/edit?tab=t.0), entry “Create 100% secure method of hiding social media passwords”. Dashboard task: [1551](https://www.highestgood.com/wbs/tasks/6adf7e8ab664eb073c94243a). Complete original request pictures are in `docs/task-evidence/Task-1551-original-request-{1,2,3}.png`.

## Clarified scope

Jae clarified on October 29, 2026, in the conversation supplied by Aditya:

> Definitely this: let backend publishing code use credentials without revealing them

He also said he did not recognize Bitwarden or Okta and believed neither was configured. This implementation uses the existing backend publishing integrations and deployment configuration. It does not implement the old PR #2065 vault-export endpoints, add a credential-view/copy feature, or require a new vendor account. The Bitwarden/Okta approach in the original assignment is historical context, not a verified existing deployment.

## Credential boundary

The backend reads `MASTODON_ACCESS_TOKEN`, `MASTODON_ENDPOINT`, `LINKEDIN_ACCESS_TOKEN` and `ORGANIZATION_URN` from its server environment. An operator must provision actual values through the backend host's protected secret settings. Use separate limited-scope test-account tokens outside production. Never place tokens in `VITE_*`, frontend storage, task screenshots, source files, PR comments or request bodies. The existing ignored local environment file can support isolated local development; no real token is required to run the mocked tests.

`socialMediaCredentials.js` validates server configuration and resolves tokens when publishing. Mastodon requires an HTTPS origin with no embedded credentials, query string or fragment. LinkedIn upload requests are constructed using fixed HTTPS origins: `www.linkedin.com/dms-uploads/` and `api.linkedin.com/mediaUpload/`. Provider-supplied URLs must match these documented endpoints and an upload path made of alphanumeric, underscore, hyphen and slash characters; signed query parameters are preserved. Other LinkedIn/licdn subdomains, unrelated paths, userinfo, fragments, whitespace, backslashes and non-default ports are rejected. An unexpected provider endpoint fails closed and needs review before it can be supported. Credential-bearing HTTP requests disable redirects. LinkedIn scheduled callbacks resolve the current token at delivery, while retaining the original organization identifier; changing the configured organization prevents that queued post from being sent to another organization.

Provider errors, Axios objects, configuration headers and arbitrary exception messages are excluded from API errors and shared logs. Logs contain a fixed operation and numeric HTTP status. Mastodon scheduled failures store fixed messages, and schedule listings replace historic raw error text. Successful immediate Mastodon responses expose only the post ID and URL rather than the entire provider object. Existing history responses retain their explicit post-field projection.

## Authorization

Global HGN middleware verifies the JWT and assigns `req.user`. Both publishers require the existing `sendEmails` permission used for announcements. Authorization runs before LinkedIn multipart parsing and covers publishing, scheduling, listing, updates, deletion and history where supported. A submitted `requestor` or role does not replace the verified identity. Authentication, permission lookup failures and missing configuration fail closed. Grant publishing rights through existing HGN role/individual permission administration; permission to publish is not permission to retrieve tokens.

## Operations and limits

Use least-privilege provider tokens for the intended account/organization. Operators retain control of deployment secrets and should revoke/rotate tokens when access changes or an exposure is suspected. The application does not claim to hide credentials from host administrators or a compromised backend. A deployment restart may be needed to load changed host settings. LinkedIn's existing in-memory scheduler is not made durable by this change; restarting the server still loses its queued jobs. Mastodon's existing claim, retry and duplicate-delivery rules are preserved.

No new secret store, database migration, credential-export endpoint, tenant configuration or production deployment is included. This does not clean historical logs/database records in place; schedule responses suppress historic error text without modifying shared data. Truth Social's legacy router is not mounted by current `startup/routes.js`, accepts test-account tokens supplied by its own caller, and is outside these active organization-token publishing paths. No real social-media accounts, applications or shared database records were used for validation.

## Validation

Run with the existing Node 20 dependencies:

```sh
npx jest --runInBand --runTestsByPath \
  src/utilities/__tests__/socialMediaCredentials.test.js \
  src/routes/__tests__/socialPublishing.security.test.js \
  src/controllers/linkedinPostController.spec.js \
  src/controllers/linkedinUpload.security.test.js \
  src/routes/__tests__/mastodonRouter.test.js \
  src/cronjobs/__tests__/mastodonScheduleJob.test.js
```

These tests mock provider HTTP, model operations and schedulers. The upload transport suite exercises the real Axios HTTP adapter with Nock interceptors and network fallback disabled, including successful signed uploads and rejected 301/302/307/308 redirects. They exercise caller authorization, forged identities, missing/malformed configuration, credential echoes in success/error responses, logs and scheduled records, rotation, scheduled organization changes, safe upload destinations, redirect settings and existing scheduling concurrency/retry behavior. Live provider authentication and production deployment remain operator verification steps; no claim of absolute security is made.

Design references: [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html), [Axios request configuration](https://github.com/axios/axios-docs/blob/master/posts/en/req_config.md).

Upload endpoint references: [LinkedIn Assets API image and video examples](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/vector-asset-api), [LinkedIn scheduled live event asset upload example](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/live-video/live-video-scheduled-live). The existing Assets/UGC API integration is retained; migration to newer provider APIs is outside this credential-security change.
