# BM lesson-list filtering API

`GET /api/bm/lessons` remains behind the existing authentication middleware.
The route, author/project reference IDs, embedded files, placeholder lessons, and
other document fields remain unchanged. No author/project population is added.
The existing schema `Date.now()` default is deliberately unchanged.

## Query parameters

- `tags`: one string or repeated parameters (`tags=safety&tags=concrete`). No CSV or JSON parsing.
  Blank/whitespace-only selections are ignored. Identical values are deduplicated.
  Matching is exact and case-sensitive, with MongoDB simple collation. Other whitespace
  is preserved so historical tag values remain selectable. Limits: 50 supplied entries
  before deduplication, 100 characters per string. The read limit accommodates legacy
  writes beyond the existing 10-character write-schema limit. Nested objects/arrays fail.
- `tagMatch`: `all` (default, MongoDB `$all`) or `any` (`$in`). With no tags, no tag predicate
  is emitted; in particular the query never contains `$all: []`.
- `dateFilter`: `all` (default), `thisWeek`, `thisMonth`, or `thisYear`.
- `timeZone`: a recognized IANA zone, default `UTC`. The frontend should send
  `Intl.DateTimeFormat().resolvedOptions().timeZone` to preserve browser-local calendars.
  Weeks start Sunday. The start is inclusive, and the next calendar period's start is
  exclusive. Boundaries use calendar arithmetic across DST, leap days, months and years.
  The full current period is included, including future dates within that period.
  `timeZone` is validated even when `dateFilter=all`.
- `sort`: `newest` (`date:-1,_id:-1`), `oldest` (`date:1,_id:1`),
  `likes` (`totalLikes:-1,_id:-1`), or `tagFrequency` (global score descending, `_id:-1`).
  Unpaginated requests with no explicit sort retain unspecified database order.
  Explicit pagination defaults to `newest`.
- `page`, `limit`: providing either enables pagination. Defaults: page 1, limit 25;
  maximum limit 100. Only canonical positive decimal integer strings are accepted
  (no signs, fractions, exponent notation, whitespace, trailing text or leading zeros).
  Safe integer arithmetic is required; maximum offset `(page-1)*limit` is 100,000.
  Deeper browsing should use a separately designed cursor API rather than unlimited skip.

Custom ranges are outside scope. Unknown parameters are ignored for legacy compatibility;
`startDate` and `endDate` do not add a date filter. A recognized invalid value (including
an empty scalar selection other than `tags`) returns HTTP 400 with `{ error: string }`.
Valid filters with no matches return HTTP 200. Database failures return a generic HTTP
500 `{ error: 'Failed to fetch lessons.' }` while details are logged server-side.

## Response compatibility

Every returned lesson additionally includes `isLiked: boolean`, derived from the JWT
identity attached by the existing middleware (`req.user.requestorId`) and matching
Like records. User IDs in query parameters are ignored. The existing `likes` array
continues to contain Like-record IDs and is unchanged. This applies to ordinary and
`tagFrequency` queries, with or without pagination. One projected Like lookup covers
only the returned lesson IDs; empty results require no lookup. No additional populate
or per-lesson database queries are introduced. The PUT like/unlike response is unchanged.


Without `page` or `limit`, the response remains an array, including with filters/sort.
With explicit pagination:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 0,
    "totalPages": 0,
    "hasNextPage": false
  }
}
```

`total` counts all matching lessons before skip/limit. A page beyond the last page
returns empty data. Data and count are independent reads, not a transactional snapshot:
concurrent creates/deletes/likes can change page membership or counts between requests.

## Database execution

Ordinary requests use `find(filter).sort(...).skip(...).limit(...)` as appropriate.
Only paginated requests perform the additional `countDocuments(filter)` query.

Tag-frequency sorting uses one aggregation request and optionally one count request.
A self-lookup with no correlated variables groups occurrences over the complete lesson
collection, including Tag Storage documents and lessons outside the active filters.
It is eligible for MongoDB's uncorrelated-subquery cache. Each lesson's score sums
those counts for every tag entry on that lesson. Duplicate tag entries contribute to
both global occurrences and that lesson's score, matching the frontend's old loops.
Outer filtering occurs before ranking; skip/limit occur after ranking. Temporary
lookup/score fields wrap the lesson and are removed before returning it. Results are
hydrated locally so Mongoose defaults, embedded file buffers, and reference serialization
match ordinary `find()` responses; hydration makes no database queries.

This is more expensive than ordinary sorts: global counts require a collection-wide
pass. Each matching lesson evaluates its tags against the global unique-tag count array.
Very large vocabularies/file payloads can hit BSON or aggregation memory limits; enabling
`allowDiskUse` does not eliminate all lookup/intermediate-document limits. Materialized
counts/scores would need separately coordinated updates and are outside this phase.
There is no per-lesson database round trip and no automatic cross-request cache that
could go stale after tag/lesson changes.

## Measured indexes and tradeoffs

The model declares three nonunique indexes with simple collation:

- `lesson_date_id`: `{ date: -1, _id: -1 }`. Supports newest/oldest browsing (reverse
  scans for oldest) and date bounds. The tag-leading index cannot replace date-only scans.
- `lesson_tags_date_id`: `{ tags: 1, date: -1, _id: -1 }`. Supports selective tag/date
  browsing. This is multikey, with tags as the only array key. Multiple `$all` conditions
  can require residual filtering; do not assume every tag combination avoids a sort.
- `lesson_likes_id`: `{ totalLikes: -1, _id: -1 }`. Supports popular-first browsing;
  it adds write work when the existing like/unlike handler updates totalLikes.

Query-plan experiment: 20,000 synthetic lessons, 110 unique tags, MongoDB 4.0.27,
new isolated loopback MongoMemoryServer. Before indexes, the tested recent-date,
two-tag-plus-date, and likes queries each examined 20,000 documents and used COLLSCAN
and SORT for a 25-result request. After indexes, the optimizer selected the corresponding
named index in each case: 25 documents and 25 keys examined, LIMIT/FETCH/IXSCAN, no
blocking SORT. The synthetic two-tag case used correlated tags; selectivity and plans
will vary with real data. A tag-frequency page over this dataset took approximately
0.4 seconds in this local experiment; this is not a production latency guarantee.

No production/shared indexes or data were accessed. Index declarations still need normal
controlled deployment; production cardinality, write overhead, build cost, competing
indexes, and sort/date selectivity should be reviewed. No hints or syncIndexes() calls
force plans or drop existing indexes. Like/date combinations may still trade filtering
against sort efficiency. These indexes do not make global tag-frequency scores indexable.

## Frontend integration

Build repeated parameters explicitly:

```js
const params = new URLSearchParams();
selectedTags.forEach(tag => params.append('tags', tag));
params.set('tagMatch', useOr ? 'any' : 'all');
params.set('dateFilter', selectedDateFilter); // all / thisWeek / thisMonth / thisYear
params.set('timeZone', Intl.DateTimeFormat().resolvedOptions().timeZone);
params.set('sort', selectedSort); // newest / oldest / likes / tagFrequency
// Optional: omit both lines to keep the array response.
params.set('page', String(page));
params.set('limit', '25');
const response = await axios.get(`${ENDPOINTS.BM_LESSONS}?${params}`);
const lessons = response.data.data; // response.data itself when pagination is omitted
```

Map the current frontend date options 1/2/3/4 to all/thisYear/thisMonth/thisWeek,
and sort options 1/2/3/4 to newest/oldest/likes/tagFrequency. Reset page to 1 when
filters/sort change; retain active parameters after like, edit, or tag-deletion refreshes.
Consume the server order rather than filtering/sorting only the current page again.
The existing action can continue author/project enrichment after unwrapping the array.
Fetch global suggestion counts from the companion endpoint below rather than downloading
all lessons or calculating counts from the current page. CSV exports still represent only
the retrieved data; full-result export needs a separate agreed contract.

## Global lesson-tag counts

`GET /api/bm/tags/counts` returns HTTP 200 with a JSON array:

```json
[
  { "tag": "Safety", "count": 42 },
  { "tag": "Construction", "count": 30 }
]
```

Counts cover the complete `buildingNewLessons` collection, including Tag Storage
placeholders. Each array occurrence contributes one, including repeated entries in
one lesson. Tags retain their original case and whitespace; simple collation keeps
case variants distinct. Sort order is count descending, then tag ascending using
MongoDB's simple/binary collation. An empty collection returns `[]`.

This endpoint has no filtering/pagination parameters: query parameters are ignored so
reusing list-filter parameters cannot accidentally produce page-scoped suggestions.
It inherits the existing `/api/bm` authentication/authorization middleware. The static
GET route is registered before the existing `/tags/:tag` DELETE route. Existing
`GET /api/bm/tags` continues to return its unchanged sorted unique-string array.

The database pipeline projects only `tags`, unwinds occurrences, groups/counts, projects
`{tag,count}`, and sorts. No lesson documents, authors/projects, content or file buffers
are returned. A database failure is logged server-side and returns HTTP 500 with
`{ "error": "Failed to fetch lesson tag counts." }`.

One aggregation is issued per request. Global recomputation still scans tag occurrences
and groups/sorts unique tags; `allowDiskUse` permits eligible stages to spill, but this
is not constant-time. Response size grows with the number of unique tags, not lessons
or attachments. No additional indexes or cross-request caches are introduced.

Frontend replacement for the full-lesson frequency fetch:

```js
const { data: tagCounts } = await axios.get(`${ENDPOINTS.BM_TAGS}/counts`);
const counts = new Map(tagCounts.map(({ tag, count }) => [tag, count]));
// Entries already have descending count and stable tag-name order.
const suggestions = tagCounts
  .filter(({ tag }) => tag.toLowerCase().includes(input.toLowerCase()))
  .filter(({ tag }) => !selectedTags.includes(tag));
```

Use original tag strings in selections and list query parameters. Load/reuse these
counts independently of list-page/filter requests; refresh after lesson/tag changes
that alter the vocabulary or occurrences. Neither date/tag filters nor pagination
should trigger a second full lesson download.

## Tests

Focused unit/controller tests cover validation, literal strings, empty/duplicate tags,
AND/OR, integer bounds, timezone boundaries, Sunday/year transitions, DST and safe errors.
A committed integration suite starts its own MongoMemoryServer and uses real MongoDB
and HTTP routing for combined filtering, ordering, counts, files/references, global
frequency semantics and case-sensitive behavior on a case-insensitive collection.
It never reads an application/shared database URI. All fixtures are dropped and the
server is stopped after testing. Existing dependencies are sufficient; no packages added.

Run the six focused Jest suites:

```sh
npm test -- --runTestsByPath \
  src/helpers/__tests__/bmLessonListQuery.test.js \
  src/controllers/bmdashboard/__tests__/bmLessonListFilters.test.js \
  src/controllers/bmdashboard/__tests__/bmLessonTagCounts.test.js \
  src/controllers/bmdashboard/__tests__/bmNewLessonController.test.js \
  src/controllers/bmdashboard/__tests__/bmLessonListFilters.integration.test.js \
  src/controllers/bmdashboard/__tests__/bmLessonIsLiked.integration.test.js
```

For an offline cached mongod binary, set MongoMemoryServer's `MONGOMS_SYSTEM_BINARY`,
`MONGOMS_VERSION`, and `MONGOMS_RUNTIME_DOWNLOAD=false` for that command. Tests require
permission to create local listening sockets. Never substitute a shared database URI.
