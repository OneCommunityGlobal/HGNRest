const axios = require('axios');

const testGitHub = async () => {
  try {
    const response = await axios.get('http://localhost:4500/api/analytics/github-reviews');
    console.log(8response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
  }
};

testGitHub();
