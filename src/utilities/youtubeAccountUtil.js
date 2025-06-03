const YoutubeAccount = require('../models/youtubeAccount');
let testAccounts = [];
try {
  testAccounts = require('../config/youtubeAccounts.data');
} catch (e) {
  // ignore if not exist
}

async function getYoutubeAccountById(id) {
  if (testAccounts.length) {
    return testAccounts.find(acc => acc.id === id) || null;
  }
  return YoutubeAccount.findById(id);
}

async function getAllYoutubeAccounts() {
  if (testAccounts.length) {
    return testAccounts;
  }
  return YoutubeAccount.find();
}

module.exports = { getYoutubeAccountById, getAllYoutubeAccounts }; 