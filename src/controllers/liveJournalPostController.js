/* eslint-disable no-console */
const crypto = require('crypto');
const xmlrpc = require('xmlrpc');
const mongoose = require('mongoose');
// eslint-disable-next-line import/no-extraneous-dependencies
const cloudinary = require('cloudinary').v2;
// eslint-disable-next-line import/no-extraneous-dependencies
const streamifier = require('streamifier');
const LiveJournalPost = require('../models/liveJournalPost');

const LJ_API_HOST = 'www.livejournal.com';
const LJ_API_PATH = '/interface/xmlrpc';
const HISTORY_LIMIT = 50;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const CUSTOM_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/xml',
  'Content-Type': 'text/xml',
  Connection: 'keep-alive',
};

const uploadToCloudinary = (fileBuffer) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'livejournal_posts' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      },
    );
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });

const getChallenge = () =>
  new Promise((resolve, reject) => {
    const client = xmlrpc.createSecureClient({
      host: LJ_API_HOST,
      port: 443,
      path: LJ_API_PATH,
      headers: CUSTOM_HEADERS,
    });

    client.methodCall('LJ.XMLRPC.getchallenge', [], (error, value) => {
      if (error) {
        if (error.body) console.error('LJ Raw Error Body:', error.body);
        reject(error);
      } else {
        resolve(value);
      }
    });
  });

const generateAuthResponse = (challenge, password) => {
  const hash = crypto.createHash('md5');
  hash.update(challenge + crypto.createHash('md5').update(password).digest('hex'));
  return hash.digest('hex');
};

const postToLiveJournal = async (postData) => {
  const challengeData = await getChallenge();
  const authResponse = generateAuthResponse(challengeData.challenge, postData.password);
  const now = new Date();

  // FIX: Removed 'title' attribute to prevent XML-RPC crash
  let finalContent = postData.content;
  if (postData.imageUrl) {
    const alt = postData.altText ? postData.altText.replace(/"/g, '&quot;') : '';
    finalContent = `<img src="${postData.imageUrl}" alt="${alt}" style="max-width:100%;" /><br/><br/>${finalContent}`;
  }

  const ljParams = {
    username: postData.username,
    auth_method: 'challenge',
    auth_challenge: challengeData.challenge,
    auth_response: authResponse,
    ver: 1,
    event: finalContent,
    subject: postData.subject || '',
    lineendings: 'unix',
    year: now.getFullYear(),
    mon: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    min: now.getMinutes(),
  };

  if (postData.security === 'private') ljParams.security = 'private';
  else if (postData.security === 'friends') {
    ljParams.security = 'usemask';
    ljParams.allowmask = 1;
  } else ljParams.security = 'public';

  if (postData.tags && postData.tags.trim()) ljParams.props = { taglist: postData.tags.trim() };

  const client = xmlrpc.createSecureClient({
    host: LJ_API_HOST,
    port: 443,
    path: LJ_API_PATH,
    headers: CUSTOM_HEADERS,
  });

  return new Promise((resolve, reject) => {
    client.methodCall('LJ.XMLRPC.postevent', [ljParams], (error, value) => {
      if (error) {
        console.error('LiveJournal API Error:', error);
        reject(error);
      } else {
        console.log('LiveJournal Success:', value);
        resolve(value);
      }
    });
  });
};

exports.createPost = async (req, res) => {
  try {
    const { username, password, subject, content, security, tags, altText } = req.body;
    let imageUrl = null;
    if (req.file) imageUrl = await uploadToCloudinary(req.file.buffer);

    const userId = req.user ? req.user._id : new mongoose.Types.ObjectId();
    if (!username || !password)
      return res
        .status(400)
        .json({ success: false, message: 'Username and password are required' });

    const result = await postToLiveJournal({
      username,
      password,
      subject,
      content,
      security: security || 'public',
      tags,
      imageUrl,
      altText,
    });

    const post = new LiveJournalPost({
      userId,
      username,
      subject: subject || 'Untitled',
      content,
      security: security || 'public',
      tags,
      status: 'posted',
      ljItemId: result.itemid,
      ljUrl: result.url,
      postedAt: new Date(),
    });
    await post.save();
    res.json({
      success: true,
      message: 'Posted successfully',
      post: { id: post._id, itemId: result.itemid, url: result.url },
    });
  } catch (error) {
    console.error('Error posting:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to post' });
  }
};

exports.schedulePost = async (req, res) => {
  try {
    const { username, password, subject, content, security, tags, scheduledDateTime, altText } =
      req.body;
    let imageUrl = null;
    if (req.file) imageUrl = await uploadToCloudinary(req.file.buffer);

    const userId = req.user ? req.user._id : new mongoose.Types.ObjectId();
    const scheduledDate = new Date(scheduledDateTime);

    // FIX: Removed 'title' attribute here as well
    let finalContent = content;
    if (imageUrl) {
      const alt = altText ? altText.replace(/"/g, '&quot;') : '';
      finalContent = `<img src="${imageUrl}" alt="${alt}" style="max-width:100%;" /><br/><br/>${content}`;
    }

    const scheduledPost = new LiveJournalPost({
      userId,
      username,
      password,
      subject: subject || 'Untitled',
      content: finalContent,
      security: security || 'public',
      tags,
      status: 'scheduled',
      scheduledFor: scheduledDate,
    });
    await scheduledPost.save();
    res.json({
      success: true,
      message: 'Post scheduled successfully',
      post: { id: scheduledPost._id, scheduledFor: scheduledDate },
    });
  } catch (error) {
    console.error('Error scheduling:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getScheduledPosts = async (req, res) => {
  try {
    const userId = req.user ? req.user._id : null;
    const scheduledPosts = await LiveJournalPost.find({
      userId: userId || { $exists: true },
      status: 'scheduled',
      scheduledFor: { $gte: new Date() },
    }).sort({ scheduledFor: 1 });
    res.json({ success: true, posts: scheduledPosts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch scheduled posts' });
  }
};

exports.deleteScheduledPost = async (req, res) => {
  try {
    const { id } = req.params;
    await LiveJournalPost.deleteOne({ _id: id });
    res.json({ success: true, message: 'Scheduled post deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete scheduled post' });
  }
};

exports.updateScheduledPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, content, security, tags, scheduledDateTime } = req.body;
    const post = await LiveJournalPost.findOne({ _id: id });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    if (subject !== undefined) post.subject = subject;
    if (content !== undefined) post.content = content;
    if (security !== undefined) post.security = security;
    if (tags !== undefined) post.tags = tags;
    if (scheduledDateTime !== undefined) post.scheduledFor = new Date(scheduledDateTime);

    await post.save();
    res.json({ success: true, message: 'Scheduled post updated successfully', post });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
};

exports.postScheduledNow = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await LiveJournalPost.findOne({ _id: id }).select('+password');
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const result = await postToLiveJournal({
      username: post.username,
      password: post.password,
      subject: post.subject,
      content: post.content,
      security: post.security,
      tags: post.tags,
    });

    post.status = 'posted';
    post.ljItemId = result.itemid;
    post.ljUrl = result.url;
    post.postedAt = new Date();
    post.scheduledFor = undefined;
    await post.save();
    res.json({
      success: true,
      message: 'Posted successfully',
      post: { id: post._id, itemId: result.itemid, url: result.url },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to post' });
  }
};

exports.getPostHistory = async (req, res) => {
  try {
    const userId = req.user ? req.user._id : null;
    const posts = await LiveJournalPost.find({
      userId: userId || { $exists: true },
      status: { $in: ['posted', 'failed'] },
    })
      .sort({ createdAt: -1 })
      .limit(HISTORY_LIMIT);
    res.json({ success: true, posts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch history' });
  }
};
