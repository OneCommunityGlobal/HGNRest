const userHelper = require('../helpers/userHelper');
const { checkXHrsForXWeeks,increaseBadgeCount, addBadge, userProfile, badge } = require('../helpers/userHelper');

async function testCheckXHrsForXWeeks() {
  let personId = '6722a58e71a31f53b4063d49';
  let badgeCollection = [];
  let testCases = [
    [30, 2], [30, 3], [30, 4], [30, 6], [30, 10], [30, 15], [30, 20], [30, 40],
    [30, 60], [30, 80], [30, 100], [30, 150], [30, 200], [40, 2], [40, 3], [40, 4],
    [40, 6], [40, 10], [40, 15], [40, 20], [40, 40], [40, 60], [40, 80], [40, 100],
    [40, 150], [40, 200], [50, 2], [50, 3], [50, 4], [50, 6], [60, 2], [60, 3],
    [60, 4], [60, 6]
  ];

  for (let [hours, weeks] of testCases) {
    let user = { savedTangibleHrs: new Array(weeks).fill(hours) };
    
    console.log(`Testing ${hours} hours for ${weeks} weeks streak...`);
    await checkXHrsForXWeeks(personId, user, badgeCollection);
    console.log(`Test completed for ${hours} hours and ${weeks} weeks.\n`);
  }
}

testCheckXHrsForXWeeks();
