test.todo('CICD pipeline hasnt had the GITHUB token set up yet');
// integration.test.js
// require('dotenv').config();
// const createGitHubClient = require('./githubPRHelper');

// const FRONT_END_REPO = 'HighestGoodNetworkApp';
// const BACK_END_REPO = 'HGNRest';
// describe('GitHub Client Integration (real API)', () => {
//   const frontEndClient = createGitHubClient({
//     owner: 'OneCommunityGlobal',
//     repo: FRONT_END_REPO,
//   });

//   const backEndClient = createGitHubClient({
//     owner: 'OneCommunityGlobal',
//     repo: BACK_END_REPO,
//   });

//   it('should fetch reviews for a PR in frontend repo(real API)', async () => {
//     // Pick a real PR number from that repo
//     const prNumber = 3646;

//     const reviews = await frontEndClient.fetchReviews(prNumber);

//     // Check it's an array (may be empty)
//     expect(Array.isArray(reviews)).toBe(true);
//   });

//   it('should fetch reviews for a PR in backend repo(real API)', async () => {
//     // Pick a real PR number from that repo
//     const prNumber = 1595;

//     const reviews = await backEndClient.fetchReviews(prNumber);

//     // Check it's an array (may be empty)
//     expect(Array.isArray(reviews)).toBe(true);
//   });

//   it('should fetch pull requests from backend repo(real API)', async () => {
//     const reviews = await backEndClient.fetchPullRequests();

//     // Check it's an array (may be empty)
//     expect(Array.isArray(reviews)).toBe(true);
//   });

//   it('should fetch pull requests from frontend repo(real API)', async () => {
//     const reviews = await frontEndClient.fetchPullRequests();

//     // Check it's an array (may be empty)
//     expect(Array.isArray(reviews)).toBe(true);
//   });

//   it('should fetch recent update in the frontend (real API)', async () => {
//     const today = new Date();
//     today.setDate(today.getDate() - 2);

//     // Get update from 2 days ago
//     const reviews = await frontEndClient.fetchRecentUpdatedPR(today.toISOString());

//     // Check it's an array (may be empty)
//     expect(Array.isArray(reviews)).toBe(true);
//   });

//   it('should fetch recent update in the backend (real API)', async () => {
//     const today = new Date();
//     today.setDate(today.getDate() - 2);

//     // Get update from 2 days ago
//     const reviews = await backEndClient.fetchRecentUpdatedPR(today.toISOString());

//     // Check it's an array (may be empty)
//     expect(Array.isArray(reviews)).toBe(true);
//   });
// });
