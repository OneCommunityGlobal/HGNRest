const bidTermsController = require('./bidTermsController');

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeBidTermsCtor = (saveMock) => {
  function FakeBidTerms(data) {
    Object.assign(this, data);
  }
  FakeBidTerms.prototype.save = saveMock;
  return FakeBidTerms;
};

describe('bidTermsController', () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
  });

  describe('postBidTerms', () => {
    it('creates bid terms when paymentTerms and cancellationPolicy are provided', async () => {
      const saved = { _id: 'terms1', paymentTerms: 'net30' };
      const saveMock = jest.fn().mockResolvedValue(saved);
      const BidTerms = makeBidTermsCtor(saveMock);
      const controller = bidTermsController(BidTerms);

      const req = {
        body: {
          paymentTerms: 'net30',
          cancellationPolicy: 'flexible',
          isActive: true,
          createdDatetime: new Date('2026-01-01'),
        },
      };

      await controller.postBidTerms(req, res);

      expect(saveMock).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(saved);
    });

    it('rejects when paymentTerms is missing', async () => {
      const saveMock = jest.fn();
      const BidTerms = makeBidTermsCtor(saveMock);
      const controller = bidTermsController(BidTerms);

      const req = { body: { cancellationPolicy: 'flexible' } };

      await controller.postBidTerms(req, res);

      expect(saveMock).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.json).toHaveBeenCalledWith({ error: 'paymentTerms should have a value' });
    });
  });
});
