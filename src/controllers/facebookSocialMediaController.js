const fetch = require('node-fetch');
const cheerio = require('cheerio');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const ScheduledPost = require('../models/scheduledPostSchema');

const facebookController = function () {
  async function extractTextAndImgUrl(htmlString) {
    const $ = cheerio.load(htmlString);
    //const textContent = $('body').text().replace(/\+/g, '').trim();
    //const textContent = $('div[style]').text().trim();
    const textContent = $.root().text().replace(/\s+/g, ' ').trim();
    const urlSrcs = [];
    const base64Srcs = [];

    $('img').each((i, img) => {
      const src = $(img).attr('src');
      if (src) {
        if (src.startsWith('data:image')) {
          base64Srcs.push(src);
        } else {
          urlSrcs.push(src);
        }
      }
    });
    return { textContent, urlSrcs, base64Srcs };
  }

  async function downloadImage(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: response.headers.get('content-type'),
    };
  }

  async function getPagesManagedByUser(authToken) {
    const requestUrl = `https://graph.facebook.com/v15.0/me/accounts`;
    try {
      const response = await axios.get(requestUrl, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const pages = response.data.data;
      const pageDetails = pages.map((page) => {
        return {
          id: page.id,
          access_token: page.access_token,
        };
      });

      return pageDetails;
    } catch (error) {
      console.error('[Backend] Error fetching pages:', error);
      throw error;
    }
  }

  async function postToPageFeed(pageId, pageAccessToken, message) {
    const requestUrl = `https://graph.facebook.com/v15.0/${pageId}/feed`;
    try {
      const response = await axios.post(
        requestUrl,
        {
          message: message,
        },
        {
          headers: {
            Authorization: `Bearer ${pageAccessToken}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      console.error('Error posting to page feed:', error);
      throw error;
    }
  }

  async function postImgToPageFeed(pageId, pageAccessToken, message, base64Srcs) {
    const requestUrl = `https://graph.facebook.com/v15.0/${pageId}/photos`;
    let form = new FormData();
    form.append('message', message);

    if (base64Srcs.length > 0) {
      base64Srcs.forEach((base64Image) => {
        const buffer = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        form.append('source', buffer, {
          filename: 'image.jpg',
          contentType: 'image/jpeg',
        });
      });
    }

    try {
      const response = await axios.post(requestUrl, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${pageAccessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Error posting to page feed:', error);
      throw error;
    }
  }

  async function scheduleFbPost(req, res) {
    const { textContent, urlSrcs, base64Srcs } = await extractTextAndImgUrl(req.body.EmailContent);
    const scheduledDate = req.body.ScheduleDate;
    const scheduledTime = req.body.ScheduleTime;

    if (!scheduledDate || !scheduledTime) {
      return res
        .status(400)
        .json({ error: 'Missing required parameters: scheduledDate or scheduledTime' });
    }

    const platform = 'facebook';
    const newScheduledFbPost = new ScheduledPost({
      textContent,
      urlSrcs,
      base64Srcs,
      scheduledDate,
      scheduledTime,
      platform,
      status: 'scheduled',
    });

    newScheduledFbPost
      .save()
      .then((scheduledFbPost) => {
        //console.log('scheduledFbPost saved:', scheduledFbPost);
        res.status(200).json({ success: true, scheduledFbPost });
      })
      .catch((error) => {
        console.error('[Backend] Database error: ', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
      });
  }

  async function schedulePostToFb(req, res) {
    const { textContent, urlSrcs, base64Srcs } = await extractTextAndImgUrl(req.body.emailContent);
    const base64Image = req.body.base64Content;
    const authToken = req.body.accessToken;
    const pages = await getPagesManagedByUser(authToken);
    if (pages.length === 0) {
      return res.status(400).json({ error: 'No pages found for this user' });
    }
    // Asumming user has access to only one page.
    const page = pages[0]; // In this case, we are posting to the first page the user manages
    const pageId = page.id;
    const pageAccessToken = page.access_token;
    let postResponse;
    try {
      if (base64Image.length > 0) {
        const postResponse = await postImgToPageFeed(
          pageId,
          pageAccessToken,
          textContent,
          base64Image,
        );
      } else {
        const postResponse = await postToPageFeed(pageId, pageAccessToken, textContent);
      }
      res.status(200).json(postResponse);
    } catch (error) {
      console.error('[Backend] Error creating Facebook post:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async function createFbPost(req, res) {
    const { textContent, urlSrcs, base64Srcs } = await extractTextAndImgUrl(req.body.emailContent);
    const authToken = req.body.accessToken;
    const pages = await getPagesManagedByUser(authToken);
    if (pages.length === 0) {
      return res.status(400).json({ error: 'No pages found for this user' });
    }
    // Asumming user has access to only one page.
    const page = pages[0]; // In this case, we are posting to the first page the user manages
    const pageId = page.id;
    const pageAccessToken = page.access_token;
    let postResponse;
    try {
      if (base64Srcs.length > 0) {
        const postResponse = await postImgToPageFeed(
          pageId,
          pageAccessToken,
          textContent,
          base64Srcs,
        );
      } else {
        const postResponse = await postToPageFeed(pageId, pageAccessToken, textContent);
      }
      res.status(200).json(postResponse);
    } catch (error) {
      console.error('[Backend] Error creating Facebook post:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async function postToFacebook(content, image) {
    const textContent = content;
    const base64Srcs = image;
    const pageId = process.env.FB_PAGEID;
    const pageAccessToken = process.env.FB_ACCESSCODE;
    let postResponse;
    try {
      if (base64Srcs.length > 0) {
        const postResponse = await postImgToPageFeed(
          pageId,
          pageAccessToken,
          textContent,
          base64Srcs,
        );
      } else {
        const postResponse = await postToPageFeed(pageId, pageAccessToken, textContent);
      }
      return postResponse;
    } catch (error) {
      console.error('[Backend] Error creating Facebook post:', error);
      throw error;
    }
  }

  return { createFbPost, schedulePostToFb, scheduleFbPost, postToFacebook };
};

module.exports = facebookController;
