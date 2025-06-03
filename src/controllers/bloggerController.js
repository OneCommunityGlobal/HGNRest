const {
    oauth2Client,
    blogger,
    setTokens,
    getTokens
} = require('../services/bloggerService');

const logger = require('../startup/logger');

exports.checkStatus = async (req, res) => {
    try {
        logger.logInfo('Checking Blogger connection status');

        const tokens = getTokens();
        if (!tokens || !tokens.access_token) {
            return res.json({ connected: false });
        }

        oauth2Client.setCredentials(tokens);

        const response = await blogger.blogs.listByUser({
            userId: 'self',
            auth: oauth2Client
        });

        logger.logInfo('Successfully retrieved blogs:', {
            blogCount: response.data.items?.length || 0
        });

        return res.json({
            connected: true,
            blogs: response.data.items || []
        });
    } catch (error) {
        logger.logException(error, 'Check Connection Status');
        return res.status(500).json({
            error: 'Failed to check connection status',
            details: error.message
        });
    }
};

exports.generateAuthUrl = async (req, res) => {
    try {
        logger.logInfo('Generating Blogger auth URL...');
        logger.logInfo('OAuth Configuration:', {
            clientId: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'missing',
            redirectUri: process.env.GOOGLE_REDIRECT_URI
        });

        const scopes = [
            'https://www.googleapis.com/auth/blogger',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email'
        ];

        const state = Math.random().toString(36).substring(7);

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent',
            state: state
        });

        logger.logInfo('Generated auth URL:', url);
        res.json({ url, state });
    } catch (error) {
        logger.logException(error, 'Generate Auth URL');
        res.status(500).json({ error: 'Failed to generate auth URL' });
    }
};

exports.handleCallback = async (req, res) => {
    const { code, state } = req.query;

    try {
        if (!code) {
            throw new Error('No authorization code received');
        }

        if (!state) {
            throw new Error('No state parameter received');
        }

        try {
            const { tokens: newTokens } = await oauth2Client.getToken(code);

            if (!newTokens) {
                throw new Error('No tokens received');
            }

            if (!newTokens.refresh_token) {
                throw new Error('No refresh token received. Please revoke app access and try again.');
            }

            setTokens(newTokens);

            oauth2Client.setCredentials({
                access_token: newTokens.access_token,
                refresh_token: newTokens.refresh_token,
                expiry_date: newTokens.expiry_date
            });

            const redirectUrl = `http://localhost:3000/announcements?auth=success&state=${state}`;
            res.redirect(redirectUrl);
        } catch (tokenError) {
            console.error('Error getting tokens:', tokenError);
            throw new Error(`Failed to get tokens: ${tokenError.message}`);
        }
    } catch (error) {
        console.error('OAuth callback error:', error);
        const errorMsg = error.message || 'Unknown error occurred';
        const redirectUrl = `http://localhost:3000/announcements?auth=error&error=${encodeURIComponent(errorMsg)}`;
        res.redirect(redirectUrl);
    }
};

exports.createPost = async (req, res) => {
    try {
        const { title, content, scheduleDate } = req.body;

        if (!title?.trim()) {
            return res.status(400).json({ error: 'Title is required' });
        }

        if (!content?.trim()) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const tokens = getTokens();
        if (!tokens || !tokens.access_token) {
            return res.status(401).json({ error: 'Not authenticated with Blogger' });
        }

        oauth2Client.setCredentials(tokens);

        try {
            const blogsResponse = await blogger.blogs.listByUser({
                userId: 'self',
                auth: oauth2Client
            });

            const blogs = blogsResponse.data.items || [];
            const targetBlog = blogs.find(blog => blog.id === process.env.GOOGLE_BLOG_ID);

            if (!targetBlog) {
                logger.logException(new Error('Blog ID not found'), 'Find Blog', {
                    availableBlogs: blogs.map(b => ({ id: b.id, name: b.name })),
                    targetBlogId: process.env.GOOGLE_BLOG_ID
                });
                return res.status(404).json({
                    error: 'Blog not found',
                    availableBlogs: blogs.map(b => ({ id: b.id, name: b.name }))
                });
            }

            logger.logInfo('Creating post in blog:', {
                blogId: targetBlog.id,
                blogName: targetBlog.name
            });
        } catch (error) {
            logger.logException(error, 'Verify Blog');
            return res.status(500).json({ error: 'Failed to verify blog access' });
        }

        const createResponse = await blogger.posts.insert({
            blogId: process.env.GOOGLE_BLOG_ID,
            auth: oauth2Client,
            requestBody: {
                title,
                content,
                kind: 'blogger#post',
                status: 'draft',
            }
        });

        const createdPost = createResponse.data;

        logger.logInfo('Successfully created draft post:', {
            postId: createdPost.id,
            url: createdPost.url
        });

        if (scheduleDate && new Date(scheduleDate) > new Date()) {
            const publishResponse = await blogger.posts.publish({
                blogId: process.env.GOOGLE_BLOG_ID,
                postId: createdPost.id,
                auth: oauth2Client,
                publishDate: scheduleDate
            });

            publishResponse.data.status = 'scheduled';

            logger.logInfo('Successfully scheduled post:', {
                postId: publishResponse.data.id,
                url: publishResponse.data.url
            });

            return res.json({
                post: publishResponse.data,
                message: 'Post scheduled successfully'
            });
        }

        const publishResponse = await blogger.posts.publish({
            blogId: process.env.GOOGLE_BLOG_ID,
            postId: createdPost.id,
            auth: oauth2Client
        });

        logger.logInfo('Successfully published post:', {
            postId: publishResponse.data.id,
            url: publishResponse.data.url
        });

        return res.json({
            post: publishResponse.data,
            message: 'Post published immediately'
        });
    } catch (error) {
        logger.logException(error, 'Create Blog Post');
        res.status(500).json({ error: 'Failed to create blog post', details: error.message });
    }
};

exports.getPosts = async (req, res) => {
    try {
        const tokens = getTokens();
        if (!tokens || !tokens.access_token) {
            return res.status(401).json({ error: 'Not authenticated with Blogger' });
        }

        oauth2Client.setCredentials(tokens);

        try {
            const blogsResponse = await blogger.blogs.listByUser({
                userId: 'self',
                auth: oauth2Client
            });

            const blogs = blogsResponse.data.items || [];
            const targetBlog = blogs.find(blog => blog.id === process.env.GOOGLE_BLOG_ID);

            if (!targetBlog) {
                logger.logException(new Error('Blog ID not found'), 'Find Blog', {
                    availableBlogs: blogs.map(b => ({ id: b.id, name: b.name })),
                    targetBlogId: process.env.GOOGLE_BLOG_ID
                });
                return res.status(404).json({
                    error: 'Blog not found',
                    availableBlogs: blogs.map(b => ({ id: b.id, name: b.name }))
                });
            }

            logger.logInfo('Fetching posts from blog:', {
                blogId: targetBlog.id,
                blogName: targetBlog.name
            });
        } catch (error) {
            logger.logException(error, 'Verify Blog');
            return res.status(500).json({ error: 'Failed to verify blog access' });
        }

        const now = new Date();

        const liveResponse = await blogger.posts.list({
            blogId: process.env.GOOGLE_BLOG_ID,
            auth: oauth2Client,
            maxResults: 10,
            orderBy: 'published',
            fetchBodies: true,
            status: 'live'
        });

        const livePosts = (liveResponse.data.items || []);
        const publishedPosts = [];
        const scheduledPosts = [];

        for (const post of livePosts) {
            const publishDate = new Date(post.published);
            if (publishDate > now) {
                post.status = 'scheduled';
                scheduledPosts.push(post);
            } else {
                post.status = 'published';
                publishedPosts.push(post);
            }
        }

        const draftsResponse = await blogger.posts.list({
            blogId: process.env.GOOGLE_BLOG_ID,
            auth: oauth2Client,
            maxResults: 10,
            orderBy: 'updated',
            fetchBodies: true,
            status: 'draft'
        });

        const draftPosts = (draftsResponse.data.items || []).map(post => ({
            ...post,
            status: 'draft'
        }));

        const allPosts = [...publishedPosts, ...scheduledPosts, ...draftPosts];

        logger.logInfo('Successfully fetched posts:', {
            total: allPosts.length,
            published: publishedPosts.length,
            draft: draftPosts.length,
            scheduled: scheduledPosts.length
        });

        res.json({
            posts: allPosts,
            summary: {
                total: allPosts.length,
                published: publishedPosts.length,
                draft: draftPosts.length,
                scheduled: scheduledPosts.length
            },
            message: `Successfully fetched ${allPosts.length} posts`
        });
    } catch (error) {
        logger.logException(error, 'Fetch Blog Posts');
        res.status(500).json({
            error: 'Failed to fetch blog posts',
            details: error.message
        });
    }
};

exports.updatePost = async (req, res) => {
    try {
        const tokens = getTokens();
        if (!tokens || !tokens.access_token) {
            return res.status(401).json({ error: 'Not authenticated with Blogger' });
        }

        const { title, content } = req.body;
        if (!title?.trim()) {
            return res.status(400).json({ error: 'Title is required' });
        }

        oauth2Client.setCredentials(tokens);

        const response = await blogger.posts.update({
            blogId: process.env.GOOGLE_BLOG_ID,
            postId: req.params.postId,
            auth: oauth2Client,
            requestBody: {
                title,
                content
            }
        });

        logger.logInfo('Successfully updated post:', {
            postId: req.params.postId,
            title
        });

        res.json({
            message: 'Post updated successfully',
            post: response.data
        });
    } catch (error) {
        logger.logException(error, 'Update Blog Post');
        res.status(500).json({
            error: 'Failed to update blog post',
            details: error.message
        });
    }
};

exports.deletePost = async (req, res) => {
    try {
        const tokens = getTokens();
        if (!tokens || !tokens.access_token) {
            return res.status(401).json({ error: 'Not authenticated with Blogger' });
        }

        oauth2Client.setCredentials(tokens);

        await blogger.posts.delete({
            blogId: process.env.GOOGLE_BLOG_ID,
            postId: req.params.postId,
            auth: oauth2Client
        });

        logger.logInfo('Successfully deleted post:', {
            postId: req.params.postId
        });

        res.json({
            message: 'Post deleted successfully'
        });
    } catch (error) {
        logger.logException(error, 'Delete Blog Post');
        res.status(500).json({
            error: 'Failed to delete blog post',
            details: error.message
        });
    }
};
