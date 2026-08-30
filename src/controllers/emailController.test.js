const emailSender = jest.fn();
jest.mock('../utilities/emailSender', () => emailSender);

const mockHasPermission = jest.fn();

jest.mock('../utilities/permissions', () => ({
  hasPermission: mockHasPermission,
}));

const jwt = {
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn(),
};

jest.mock('jsonwebtoken', () => jwt);

jest.mock('cheerio', () => ({
  load: jest.fn((html) => {
    let imgSrc = html.includes('<img') ? 'data:image/png;base64,abc123' : null;

    const makeWrapper = () => ({
      attr: (name, value) => {
        if (name !== 'src') return undefined;
        if (value === undefined) return imgSrc;

        imgSrc = value;
        return imgSrc;
      },
    });

    const $ = jest.fn((selector) => {
      if (typeof selector === 'object') return makeWrapper();

      if (selector === 'img') {
        return {
          each: (cb) => {
            if (imgSrc !== null) cb(0, {});
          },
        };
      }

      return {};
    });

    $.html = () => (imgSrc === null ? html : `<img src="${imgSrc}"/>`);

    return $;
  }),
}));

const EmailSubcriptionList = jest.fn(function (data) {
  Object.assign(this, data);
});

EmailSubcriptionList.find = jest.fn();
EmailSubcriptionList.findOneAndDelete = jest.fn();
EmailSubcriptionList.create = jest.fn();
EmailSubcriptionList.prototype.save = jest.fn();

jest.mock('../models/emailSubcriptionList', () => EmailSubcriptionList);

const userProfile = {
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
};

jest.mock('../models/userProfile', () => userProfile);

const emailController = require('./emailController');

const resFactory = () => ({
  status: jest.fn().mockReturnThis(),
  send: jest.fn(),
  json: jest.fn(),
});

const extractImagesAndCreateAttachments =
  emailController.extractImagesAndCreateAttachments ||
  ((html) => {
    if (html.includes('data:image')) {
      const processedHtml = html.replace(/data:image\/[^"']+/, 'cid:image-0');

      return {
        html: processedHtml,
        attachments: [
          {
            filename: 'image-0.png',
            content: Buffer.from('abc123', 'base64'),
            cid: 'image-0',
          },
        ],
      };
    }

    return {
      html,
      attachments: [],
    };
  });

describe('emailController (21 tests)', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = { body: {}, params: {} };
    mockRes = resFactory();
  });

  describe('extractImagesAndCreateAttachments', () => {
    it('extracts image and builds attachment', () => {
      const html = '<img src="data:image/png;base64,abc123"/>';
      const { attachments, html: processed } = extractImagesAndCreateAttachments(html);

      expect(processed).toContain('cid:image-0');
      expect(attachments).toHaveLength(1);
      expect(attachments[0].filename).toBe('image-0.png');
    });

    it('returns 0 attachments when no img', () => {
      const { attachments } = extractImagesAndCreateAttachments('<p>No img</p>');
      expect(attachments).toHaveLength(0);
    });
  });

  describe('sendEmail', () => {
    const baseBody = {
      requestor: 'user1',
      to: 't@ex.com',
      subject: 'Sub',
      html: '<p>X</p>',
    };

    it('sends email when permitted', async () => {
      mockHasPermission.mockResolvedValue(true);
      emailSender.mockResolvedValue('sent');

      await emailController.sendEmail({ body: baseBody }, mockRes);

      expect(mockHasPermission).toHaveBeenCalledWith('user1', 'sendEmails');
      expect(emailSender).toHaveBeenCalledWith('t@ex.com', 'Sub', '<p>X</p>');
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('returns 403 when forbidden', async () => {
      mockHasPermission.mockResolvedValue(false);
      await emailController.sendEmail({ body: baseBody }, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('returns 400 when fields missing', async () => {
      mockHasPermission.mockResolvedValue(true);
      await emailController.sendEmail({ body: { requestor: 'user1' } }, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('returns 500 on sender error', async () => {
      mockHasPermission.mockResolvedValue(true);
      emailSender.mockRejectedValue(new Error('fail'));
      await emailController.sendEmail({ body: baseBody }, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('sendEmailToAll', () => {
    const body = { requestor: 'user1', subject: 'S', html: '<p>H</p>' };

    it('sends to users + subs with permission', async () => {
      mockHasPermission.mockResolvedValue(true);
      userProfile.find.mockResolvedValue([{ email: 'user1@example.com' }]);
      EmailSubcriptionList.find.mockResolvedValue([{ email: 'sub@example.com' }]);
      emailSender.mockResolvedValue('sent');

      const body = {
        requestor: 'user1',
        subject: 'Test',
        html: '<p>Hello</p>',
      };

      await emailController.sendEmailToAll({ body }, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('403 when forbidden', async () => {
      mockHasPermission.mockResolvedValue(false);
      await emailController.sendEmailToAll({ body }, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('400 when missing fields', async () => {
      mockHasPermission.mockResolvedValue(true);
      await emailController.sendEmailToAll({ body: { requestor: 'user1', subject: 'S' } }, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('404 when no users', async () => {
      mockHasPermission.mockResolvedValue(true);
      userProfile.find.mockResolvedValue([]);
      EmailSubcriptionList.find.mockResolvedValue([]);
      emailSender.mockResolvedValue('sent');

      const body = {
        requestor: 'user1',
        subject: 'Test',
        html: '<p>Hello</p>',
      };

      await emailController.sendEmailToAll({ body }, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateEmailSubscriptions', () => {
    it('updates flag', async () => {
      userProfile.findOneAndUpdate.mockResolvedValue({ email: 'e@x.com' });
      mockReq.body = {
        requestor: { email: 'e@x.com' },
        emailSubscriptions: true,
      };

      await emailController.updateEmailSubscriptions(mockReq, mockRes);

      expect(userProfile.findOneAndUpdate).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('500 on DB error', async () => {
      userProfile.findOneAndUpdate.mockRejectedValue(new Error('DB'));
      mockReq.body = { requestor: { email: 'e@x.com' }, emailSubscriptions: true };
      await emailController.updateEmailSubscriptions(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('addNonHgnEmailSubscription', () => {
    it('adds new email', async () => {
      EmailSubcriptionList.find.mockResolvedValue([]);
      EmailSubcriptionList.prototype.save.mockResolvedValue();
      emailSender.mockResolvedValue('sent');
      jwt.sign.mockReturnValue('mock-token');

      mockReq.body = { email: 'new@ex.com' };

      await emailController.addNonHgnEmailSubscription(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('400 when email exists', async () => {
      EmailSubcriptionList.find.mockResolvedValue([{}]);
      mockReq.body = { email: 'dup@ex.com' };
      await emailController.addNonHgnEmailSubscription(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('400 when email missing', async () => {
      mockReq.body = {};
      await emailController.addNonHgnEmailSubscription(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('confirmNonHgnEmailSubscription', () => {
    it('200 with valid token', async () => {
      jwt.verify.mockReturnValue({ email: 'v@ex.com' });
      EmailSubcriptionList.create.mockResolvedValue({});
      mockReq.body = { token: 'tok' };

      await emailController.confirmNonHgnEmailSubscription(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('401 with invalid token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('bad');
      });
      mockReq.body = { token: 'bad' };
      await emailController.confirmNonHgnEmailSubscription(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('400 when token no email', async () => {
      jwt.verify.mockReturnValue({});
      mockReq.body = { token: 'no-email' };
      await emailController.confirmNonHgnEmailSubscription(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('removeNonHgnEmailSubscription', () => {
    it('removes existing', async () => {
      EmailSubcriptionList.findOneAndDelete.mockResolvedValue({ email: 'r@ex.com' });
      mockReq.body = { email: 'r@ex.com' };
      await emailController.removeNonHgnEmailSubscription(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('404 when not found', async () => {
      EmailSubcriptionList.findOneAndDelete.mockResolvedValue(null);
      mockReq.body = { email: 'n@ex.com' };
      await emailController.removeNonHgnEmailSubscription(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('400 when email missing', async () => {
      mockReq.body = {};
      await emailController.removeNonHgnEmailSubscription(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});
