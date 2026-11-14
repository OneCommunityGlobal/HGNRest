jest.mock('../../../startup/logger', () => ({ logException: jest.fn() }));
jest.mock('../../../utilities/emailSender', () => jest.fn());

const mongoose = require('mongoose');
const emailSender = require('../../../utilities/emailSender');
const bmRentalActionsController = require('../bmRentalActionsController');

const DAY_MS = 24 * 60 * 60 * 1000;
const ITEM_ID = new mongoose.Types.ObjectId().toString();
const USER_ID = new mongoose.Types.ObjectId().toString();
const REQUESTOR_ID = new mongoose.Types.ObjectId().toString();

// Model.findById(...).populate(...) and Model.findByIdAndUpdate(...).populate(...)
const chain = (value) => ({ populate: jest.fn().mockResolvedValue(value) });

const makeModel = (doc = null) => ({
  findById: jest.fn(() => chain(doc)),
  findByIdAndUpdate: jest.fn((id, update) => {
    const updated = { ...doc, ...(update.$set || {}) };
    return Object.assign(Promise.resolve(updated), {
      populate: jest.fn().mockResolvedValue(updated),
    });
  }),
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
};

const rental = (overrides = {}) => ({
  _id: ITEM_ID,
  purchaseStatus: 'Rental',
  rentalDueDate: new Date(Date.now() + 2 * DAY_MS),
  itemType: { name: 'Excavator' },
  project: { name: 'Building 2' },
  logRecord: [{ type: 'Check Out', responsibleUser: USER_ID }],
  rentalHistory: [],
  ...overrides,
});

const setup = ({ tool = null, equipment = null, user = null } = {}) => {
  const BuildingTool = makeModel(tool);
  const BuildingEquipment = makeModel(equipment);
  const UserProfile = {
    findById: jest.fn(() => ({ select: () => ({ lean: jest.fn().mockResolvedValue(user) }) })),
  };
  const controller = bmRentalActionsController(BuildingTool, BuildingEquipment, UserProfile);
  return { controller, BuildingTool, BuildingEquipment, UserProfile };
};

const req = (body = {}, itemId = ITEM_ID) => ({
  params: { itemId },
  body: { requestor: { requestorId: REQUESTOR_ID }, ...body },
});

beforeEach(() => jest.clearAllMocks());

describe('shared validation', () => {
  it('rejects an invalid item id', async () => {
    const { controller } = setup();
    const res = makeRes();
    await controller.markReturned(req({}, 'not-an-id'), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when the item is neither a tool nor equipment', async () => {
    const { controller } = setup();
    const res = makeRes();
    await controller.markReturned(req(), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 409 when the item is not an active rental', async () => {
    const { controller } = setup({ tool: rental({ purchaseStatus: 'Purchased' }) });
    const res = makeRes();
    await controller.markReturned(req(), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('markReturned', () => {
  it('sets status Returned, records history, and reports lateness', async () => {
    const overdue = rental({ rentalDueDate: new Date(Date.now() - DAY_MS) });
    const { controller, BuildingEquipment } = setup({ equipment: overdue });
    const res = makeRes();
    await controller.markReturned(req(), res);

    const [, update, options] = BuildingEquipment.findByIdAndUpdate.mock.calls[0];
    expect(update.$set.purchaseStatus).toBe('Returned');
    expect(update.$set.rentalReturnedDate).toBeInstanceOf(Date);
    expect(update.$push.rentalHistory).toMatchObject({
      action: 'Returned',
      createdBy: REQUESTOR_ID,
      previousDueDate: overdue.rentalDueDate,
    });
    expect(options).toMatchObject({ new: true, runValidators: true });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send.mock.calls[0][0].returnedLate).toBe(true);
  });
});

describe('extendRental', () => {
  it('requires a valid date', async () => {
    const { controller } = setup({ tool: rental() });
    const res = makeRes();
    await controller.extendRental(req({ rentalDueDate: 'nope' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a date that is not after the current due date', async () => {
    const item = rental();
    const { controller } = setup({ tool: item });
    const res = makeRes();
    await controller.extendRental(req({ rentalDueDate: new Date(Date.now() + DAY_MS) }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send.mock.calls[0][0].message).toMatch(/after the current due date/);
  });

  it('updates the due date and records the change', async () => {
    const item = rental();
    const { controller, BuildingTool } = setup({ tool: item });
    const res = makeRes();
    const newDue = new Date(Date.now() + 10 * DAY_MS);
    await controller.extendRental(req({ rentalDueDate: newDue.toISOString() }), res);

    const [, update] = BuildingTool.findByIdAndUpdate.mock.calls[0];
    expect(update.$set.rentalDueDate.getTime()).toBe(newDue.getTime());
    expect(update.$push.rentalHistory).toMatchObject({
      action: 'Extended',
      previousDueDate: item.rentalDueDate,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('sendReminder', () => {
  const user = { _id: USER_ID, firstName: 'Ana', lastName: 'Lee', email: 'ana@example.com' };

  it('emails the person on the latest check-out and records it', async () => {
    emailSender.mockResolvedValue('sent');
    const { controller, BuildingTool, UserProfile } = setup({ tool: rental(), user });
    const res = makeRes();
    await controller.sendReminder(req(), res);

    expect(UserProfile.findById).toHaveBeenCalledWith(USER_ID);
    expect(emailSender).toHaveBeenCalledWith(
      'ana@example.com',
      'Rental return reminder: Excavator',
      expect.stringContaining('Building 2'),
    );
    expect(BuildingTool.findByIdAndUpdate.mock.calls[0][1].$push.rentalHistory).toMatchObject({
      action: 'Reminder Sent',
      sentTo: USER_ID,
    });
    expect(res.send).toHaveBeenCalledWith({ sentTo: 'Ana Lee', emailSent: true });
  });

  it('reports when email sending is disabled outside production', async () => {
    emailSender.mockResolvedValue('EMAIL_SENDING_DISABLED_NON_PROD');
    const { controller } = setup({ tool: rental(), user });
    const res = makeRes();
    await controller.sendReminder(req(), res);
    expect(res.send).toHaveBeenCalledWith({ sentTo: 'Ana Lee', emailSent: false });
  });

  it('returns 422 when nobody responsible has an email', async () => {
    const { controller } = setup({ tool: rental({ logRecord: [], userResponsible: undefined }) });
    const res = makeRes();
    await controller.sendReminder(req(), res);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(emailSender).not.toHaveBeenCalled();
  });

  it('limits reminders to one per item per 24 hours', async () => {
    const item = rental({
      rentalHistory: [{ action: 'Reminder Sent', date: new Date(Date.now() - 60 * 60 * 1000) }],
    });
    const { controller } = setup({ tool: item, user });
    const res = makeRes();
    await controller.sendReminder(req(), res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(emailSender).not.toHaveBeenCalled();
  });

  it('escapes item names in the email body', async () => {
    emailSender.mockResolvedValue('sent');
    const item = rental({ itemType: { name: '<script>x</script>' } });
    const { controller } = setup({ tool: item, user });
    await controller.sendReminder(req(), makeRes());
    expect(emailSender.mock.calls[0][2]).toContain('&lt;script&gt;');
    expect(emailSender.mock.calls[0][2]).not.toContain('<script>');
  });
});
