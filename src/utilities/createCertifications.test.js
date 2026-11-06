jest.mock('dotenv', () => ({ config: jest.fn() }));

jest.mock('mongoose', () => ({
  connect: jest.fn(),
  connection: { close: jest.fn() },
}));

jest.mock('../models/certification', () => ({
  createCollection: jest.fn(),
}));

jest.mock('../models/educatorCertification', () => ({
  createCollection: jest.fn(),
}));

const mongoose = require('mongoose');
const certification = require('../models/certification');
const educatorCertification = require('../models/educatorCertification');
const { connect, createCollections } = require('./createCertifications');

describe('createCertifications utility', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      user: 'testUser',
      password: 'p@ss:word',
      cluster: 'testCluster',
      dbName: 'testDb',
      appName: 'testApp',
    };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('connect function', () => {
    it('builds the connection URI from env vars and connects with expected options', async () => {
      mongoose.connect.mockResolvedValue();

      await connect();

      const expectedUri =
        'mongodb+srv://testUser:p%40ss%3Aword@testCluster/testDb?retryWrites=true&w=majority&appName=testApp';

      expect(mongoose.connect).toHaveBeenCalledWith(expectedUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    });

    it('URL-encodes special characters in the password', async () => {
      process.env.password = 'p@ss word/!';
      mongoose.connect.mockResolvedValue();

      await connect();

      const [uri] = mongoose.connect.mock.calls[0];
      expect(uri).toContain(encodeURIComponent('p@ss word/!'));
    });

    it('propagates a connection error', async () => {
      const error = new Error('connection failed');
      mongoose.connect.mockRejectedValue(error);

      await expect(connect()).rejects.toThrow('connection failed');
    });
  });

  describe('createCollections function', () => {
    it('connects, creates both collections, and closes the connection on success', async () => {
      mongoose.connect.mockResolvedValue();
      certification.createCollection.mockResolvedValue();
      educatorCertification.createCollection.mockResolvedValue();

      await createCollections();

      expect(mongoose.connect).toHaveBeenCalledTimes(1);
      expect(certification.createCollection).toHaveBeenCalledTimes(1);
      expect(educatorCertification.createCollection).toHaveBeenCalledTimes(1);
      expect(mongoose.connection.close).toHaveBeenCalledTimes(1);
    });

    it('still closes the connection when connect() fails', async () => {
      mongoose.connect.mockRejectedValue(new Error('connection failed'));

      await createCollections();

      expect(certification.createCollection).not.toHaveBeenCalled();
      expect(educatorCertification.createCollection).not.toHaveBeenCalled();
      expect(mongoose.connection.close).toHaveBeenCalledTimes(1);
    });

    it('still closes the connection when a collection creation fails', async () => {
      mongoose.connect.mockResolvedValue();
      certification.createCollection.mockRejectedValue(new Error('create failed'));
      educatorCertification.createCollection.mockResolvedValue();

      await createCollections();

      expect(mongoose.connection.close).toHaveBeenCalledTimes(1);
    });

    it('does not throw even when every step fails', async () => {
      mongoose.connect.mockRejectedValue(new Error('boom'));

      await expect(createCollections()).resolves.toBeUndefined();
    });
  });
});
