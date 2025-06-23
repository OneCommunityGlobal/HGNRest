module.exports = [
  {
    id: 'test1',
    displayName: 'Test Channel 1',
    clientId: process.env.YT_CLIENT_ID || 'your_client_id_here',
    clientSecret: process.env.YT_CLIENT_SECRET || 'your_client_secret_here',
    redirectUri: process.env.YT_REDIRECT_URI || 'https://developers.google.com/oauthplayground',
    refreshToken: process.env.YT_REFRESH_TOKEN || 'your_refresh_token_here',
    channelId: 'UCxxxxxx'
  },
  {
    id: 'test2',
    displayName: 'Test Channel 2',
    clientId: 'yyy.apps.googleusercontent.com',
    clientSecret: 'yyyy',
    redirectUri: 'https://developers.google.com/oauthplayground',
    refreshToken: 'yyyy',
    channelId: 'UCyyyyyy'
  }
]; 