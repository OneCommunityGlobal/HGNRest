// eslint-disable-next-line import/no-extraneous-dependencies
const fetch = require('node-fetch');
const ProfileInitialSetupToken = require('../models/profileInitialSetupToken');
const { hasPermission } = require('../utilities/permissions');

const premiumKey = process.env.TIMEZONE_PREMIUM_KEY;
const commonKey = process.env.TIMEZONE_COMMON_KEY;

const performTimeZoneRequest = async (req, res, apiKey) => {
  const { location } = req.params;

  if (!location) {
    res.status(400).send('Missing location');
    return;
  }

  try {
    const geocodeAPIEndpoint = 'https://api.opencagedata.com/geocode/v1/json';
    const url = `${geocodeAPIEndpoint}?key=${apiKey}&q=${location}&pretty=1&limit=1`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status.code !== 200) {
      const err = new Error(`opencage error- ${data.status.message}`);
      err.status = data.status.code;
      throw err;
    }

    if (data.results && data.results.length) {
      const timezone = data.results[0].annotations.timezone.name;
      const currentLocation = {
        userProvided: location,
        coords: {
          lat: data.results[0].geometry.lat,
          lng: data.results[0].geometry.lng,
        },
        country: data.results[0].components.country || '',
        city: data.results[0].components.city || '',
      };
      res.status(200).send({ timezone, currentLocation });
    } else {
      res.status(404).send('No results found');
    }
  } catch (err) {
    const errorMessage = err?.data?.status?.message
      ? `opencage error, ${err?.data?.status?.message}`
      : err.message;
    const errorCode = err?.status || 500;
    res.status(errorCode).send(errorMessage);
  }
};

const timeZoneAPIController = function () {
  const getTimeZone = async (req, res) => {
    const { requestor } = req.body;

    if (!requestor.role) {
      res.status(403).send('Unauthorized Request');
      return;
    }

    const userAPIKey = (await hasPermission(requestor, 'getTimeZoneAPIKey'))
      ? premiumKey
      : commonKey;
    if (!userAPIKey) {
      res.status(401).send('API Key Missing');
      return;
    }

    await performTimeZoneRequest(req, res, userAPIKey);
  };

  const getTimeZoneProfileInitialSetup = async (req, res) => {
    const { token } = req.body;
    if (!token) {
      res.status(400).send('Missing token');
      return;
    }

    const foundToken = await ProfileInitialSetupToken.findOne({ token });
    if (!foundToken) {
      res.status(403).send('Unauthorized Request');
      return;
    }

    const userAPIKey = commonKey;
    await performTimeZoneRequest(req, res, userAPIKey);
  };

  return {
    getTimeZone,
    getTimeZoneProfileInitialSetup,
  };
};

module.exports = timeZoneAPIController;
