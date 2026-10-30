const mongoose = require('mongoose');
const ImgurPost = require('./imgurPosts');

describe('ImgurPost Model', () => {
  describe('Schema validation', () => {
    test('should have required fields', () => {
      const { schema } = ImgurPost;

      expect(schema.paths.userId).toBeDefined();
      expect(schema.paths.userId.isRequired).toBe(true);

      expect(schema.paths.title).toBeDefined();
      expect(schema.paths.title.isRequired).toBe(true);

      expect(schema.paths.scheduledTime).toBeDefined();
      expect(schema.paths.scheduledTime.isRequired).toBe(true);
    });

    test('should have optional fields', () => {
      const { schema } = ImgurPost;

      // These fields are optional (not required)
      expect(schema.paths.description).toBeDefined();
      expect(schema.paths.images).toBeDefined();

      // Check they're not required by checking the required property
      // In Mongoose, if isRequired is not true, field is optional
      expect(schema.paths.description.options.required).not.toBe(true);
      expect(schema.paths.images.options.required).not.toBe(true);
    });

    test('userId should reference UserProfile', () => {
      const { schema } = ImgurPost;
      const userIdPath = schema.paths.userId;

      expect(userIdPath.instance).toBe('ObjectID');
      expect(userIdPath.options.ref).toBe('UserProfile');
    });

    test('title should have maxlength of 256', () => {
      const { schema } = ImgurPost;
      const titlePath = schema.paths.title;

      expect(titlePath.options.maxlength).toBe(256);
    });

    test('description should have large maxlength', () => {
      const { schema } = ImgurPost;
      const descPath = schema.paths.description;

      expect(descPath.options.maxlength).toBe(16777216);
    });

    test('status should have valid enum values', () => {
      const { schema } = ImgurPost;
      const statusPath = schema.paths.status;

      expect(statusPath.enumValues).toEqual(['pending', 'publishing', 'posted', 'failed']);
      expect(statusPath.defaultValue).toBe('pending');
    });

    test('images should be an array with correct subdocument schema', () => {
      const { schema } = ImgurPost;
      const imagesPath = schema.paths.images;

      expect(imagesPath.instance).toBe('Array');
      // Check that images subdocument has expected fields
      const imageSchema = imagesPath.schema;
      expect(imageSchema.paths.filename).toBeDefined();
      expect(imageSchema.paths.size).toBeDefined();
      expect(imageSchema.paths.mimetype).toBeDefined();
      expect(imageSchema.paths.buffer).toBeDefined();
    });

    test('should have timestamps', () => {
      const { schema } = ImgurPost;

      expect(schema.paths.createdAt).toBeDefined();
      expect(schema.paths.updatedAt).toBeDefined();
    });
  });

  describe('Schema indexes', () => {
    test('should have indexes defined', () => {
      const { schema } = ImgurPost;

      // Check that individual fields have index option
      expect(schema.paths.userId.options.index).toBe(true);
      expect(schema.paths.status.options.index).toBe(true);
      expect(schema.paths.scheduledTime.options.index).toBe(true);
    });

    test('userId should be indexed individually', () => {
      const { schema } = ImgurPost;
      const userIdPath = schema.paths.userId;

      expect(userIdPath.options.index).toBe(true);
    });

    test('status should be indexed individually', () => {
      const { schema } = ImgurPost;
      const statusPath = schema.paths.status;

      expect(statusPath.options.index).toBe(true);
    });

    test('scheduledTime should be indexed individually', () => {
      const { schema } = ImgurPost;
      const scheduledTimePath = schema.paths.scheduledTime;

      expect(scheduledTimePath.options.index).toBe(true);
    });
  });

  describe('DELIVERY_STATUSES export', () => {
    test('should export DELIVERY_STATUSES constant', () => {
      expect(ImgurPost.DELIVERY_STATUSES).toBeDefined();
    });

    test('DELIVERY_STATUSES should have correct values', () => {
      expect(ImgurPost.DELIVERY_STATUSES).toEqual(['pending', 'publishing', 'posted', 'failed']);
    });

    test('DELIVERY_STATUSES values should match schema enum', () => {
      const { schema } = ImgurPost;
      const statusPath = schema.paths.status;

      ImgurPost.DELIVERY_STATUSES.forEach((status) => {
        expect(statusPath.enumValues).toContain(status);
      });
    });
  });

  describe('Model instantiation', () => {
    test('should have correct model name', () => {
      expect(ImgurPost.collection.name).toBe('imgurposts');
    });

    test('should create instance with valid data', () => {
      const postData = {
        userId: new mongoose.Types.ObjectId(),
        title: 'Test Album',
        description: 'Test Description',
        scheduledTime: new Date(),
        status: 'pending',
      };

      const post = new ImgurPost(postData);

      expect(post.userId).toEqual(postData.userId);
      expect(post.title).toBe('Test Album');
      expect(post.description).toBe('Test Description');
      expect(post.status).toBe('pending');
    });

    test('should set default status to pending', () => {
      const postData = {
        userId: new mongoose.Types.ObjectId(),
        title: 'Test Album',
        scheduledTime: new Date(),
      };

      const post = new ImgurPost(postData);

      expect(post.status).toBe('pending');
    });

    test('should initialize images as empty array by default', () => {
      const postData = {
        userId: new mongoose.Types.ObjectId(),
        title: 'Test Album',
        scheduledTime: new Date(),
      };

      const post = new ImgurPost(postData);

      expect(Array.isArray(post.images)).toBe(true);
      expect(post.images.length).toBe(0);
    });

    test('should accept images array', () => {
      const images = [
        {
          filename: 'test.jpg',
          mimetype: 'image/jpeg',
          size: 1024,
          buffer: Buffer.from('test'),
        },
      ];

      const postData = {
        userId: new mongoose.Types.ObjectId(),
        title: 'Test Album',
        scheduledTime: new Date(),
        images,
      };

      const post = new ImgurPost(postData);

      expect(post.images.length).toBe(1);
      expect(post.images[0].filename).toBe('test.jpg');
    });

    test('should allow setting lockOwner and lockedUntil', () => {
      const now = new Date();
      const lockUntil = new Date(now.getTime() + 60000);

      const postData = {
        userId: new mongoose.Types.ObjectId(),
        title: 'Test Album',
        scheduledTime: new Date(),
        lockOwner: 'worker-1',
        lockedUntil: lockUntil,
      };

      const post = new ImgurPost(postData);

      expect(post.lockOwner).toBe('worker-1');
      expect(post.lockedUntil).toEqual(lockUntil);
    });

    test('should track attempts', () => {
      const postData = {
        userId: new mongoose.Types.ObjectId(),
        title: 'Test Album',
        scheduledTime: new Date(),
        attempts: 3,
      };

      const post = new ImgurPost(postData);

      expect(post.attempts).toBe(3);
    });

    test('should store error information', () => {
      const postData = {
        userId: new mongoose.Types.ObjectId(),
        title: 'Test Album',
        scheduledTime: new Date(),
        lastError: 'Network timeout',
      };

      const post = new ImgurPost(postData);

      expect(post.lastError).toBe('Network timeout');
    });

    test('should store Imgur post details', () => {
      const postData = {
        userId: new mongoose.Types.ObjectId(),
        title: 'Test Album',
        scheduledTime: new Date(),
        remotePostId: 'album123',
        albumId: 'album123',
        imgurUrl: 'https://imgur.com/a/album123',
        postedAt: new Date(),
      };

      const post = new ImgurPost(postData);

      expect(post.remotePostId).toBe('album123');
      expect(post.albumId).toBe('album123');
      expect(post.imgurUrl).toBe('https://imgur.com/a/album123');
      expect(post.postedAt).toEqual(postData.postedAt);
    });
  });
});
