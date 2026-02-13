/* eslint-disable quotes */
const express = require('express');
const cheerio = require('cheerio');
const ScheduledPost = require('../models/scheduledPostSchema');

const router = express.Router();

function extractTextAndImgUrl(htmlString) {
  const $ = cheerio.load(htmlString);

  const textContent = $('body').text().replace(/\+/g, '').trim();
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

const { postToPlurk, diagnosePlurkAuth } = require('../controllers/plurkController');

router.post('/postToPlurk', async (req, res) => {
  console.log('Received request to /postToPlurk', req.body);

  try {
    const content = (req.body?.content || '').trim();
    const result = await postToPlurk(content);
    return res.json({
      plurk_id: result.plurk_id,
      posted: result.posted,
      qualifier: result.qualifier,
    });
  } catch (err) {
    if (
      err.message === 'Plurk content cannot be empty.' ||
      err.message === 'Plurk content must be 360 chars or less.'
    ) {
      return res.status(400).json({ error: err.message });
    }
    if (err.statusCode) {
      return res
        .status(err.statusCode)
        .json({ error: err.data || err.message || 'Plurk API failed' });
    }
    console.error('Plurk route error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/plurk/diagnose', async (req, res) => {
  try {
    const result = await diagnosePlurkAuth();
    return res.status(200).json({
      ok: true,
      env: {
        PLURK_CONSUMER_KEY: !!process.env.PLURK_CONSUMER_KEY,
        PLURK_CONSUMER_SECRET: !!process.env.PLURK_CONSUMER_SECRET,
        PLURK_TOKEN: !!process.env.PLURK_TOKEN,
        PLURK_TOKEN_SECRET: !!process.env.PLURK_TOKEN_SECRET,
      },
      plurk: {
        id: result.id,
        nick_name: result.nick_name,
        display_name: result.display_name,
      },
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      ok: false,
      env: {
        PLURK_CONSUMER_KEY: !!process.env.PLURK_CONSUMER_KEY,
        PLURK_CONSUMER_SECRET: !!process.env.PLURK_CONSUMER_SECRET,
        PLURK_TOKEN: !!process.env.PLURK_TOKEN,
        PLURK_TOKEN_SECRET: !!process.env.PLURK_TOKEN_SECRET,
      },
      error: {
        statusCode: err.statusCode,
        data: err.data,
        message: err.message,
      },
    });
  }
});

router.post('/schedulePost', async (req, res) => {
  console.log('Received request to /schedulePost', req.body);
  try {
    const { textContent, urlSrcs, base64Srcs } = extractTextAndImgUrl(req.body.EmailContent);
    const scheduledDate = req.body.ScheduleDate;
    const scheduledTime = req.body.ScheduleTime;

    if (!scheduledDate || !scheduledTime) {
      return res
        .status(400)
        .json({ error: 'Missing required parameters: scheduledDate or scheduledTime' });
    }

    const platform = 'plurk';
    const newScheduledPost = new ScheduledPost({
      textContent,
      urlSrcs,
      base64Srcs,
      scheduledDate,
      scheduledTime,
      platform,
      status: 'scheduled',
    });

    const savedPost = await newScheduledPost.save();
    console.log('Scheduled Plurk post saved:', savedPost);
    return res.status(200).json({ success: true, scheduledPost: savedPost });
  } catch (error) {
    console.error('Plurk schedule error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/deleteSchedulePost', async (req, res) => {
  console.log('Received request to /deleteSchedulePost', req.body);
  const { _id } = req.body;

  if (!_id) {
    return res.status(400).json({ error: 'Missing required parameter: _id' });
  }

  try {
    const deletedPost = await ScheduledPost.findOneAndDelete({ _id });

    if (!deletedPost) {
      return res.status(404).json({ error: 'Post not found or already deleted' });
    }

    return res.status(200).json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Plurk delete schedule error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
