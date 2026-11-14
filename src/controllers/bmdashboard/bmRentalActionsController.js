const mongoose = require('mongoose');
const { logException } = require('../../startup/logger');
const emailSender = require('../../utilities/emailSender');

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_COOLDOWN_MS = DAY_MS;
const ACTIVE_RENTAL_STATUSES = ['Rental', 'Rented'];

const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
  );

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });

// Quick actions for rented tools and equipment on the BM project dashboard:
// mark returned, extend the due date, and email a return reminder.
const bmRentalActionsController = function (BuildingTool, BuildingEquipment, UserProfile) {
  const POPULATE = [
    { path: 'itemType', select: '_id name category imageUrl' },
    { path: 'project', select: '_id name' },
  ];

  // Tools and equipment share the buildingInventoryItems collection but are
  // separate discriminator models, so look in both.
  const findRentalItem = async (itemId) => {
    const tool = await BuildingTool.findById(itemId).populate(POPULATE);
    if (tool) return { item: tool, Model: BuildingTool, kind: 'tool' };
    const equipment = await BuildingEquipment.findById(itemId).populate(POPULATE);
    if (equipment) return { item: equipment, Model: BuildingEquipment, kind: 'equipment' };
    return null;
  };

  // Shared checks: valid id, item exists, and it is an active rental.
  const loadActiveRental = async (req, res) => {
    const { itemId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      res.status(400).send({ message: 'Invalid item ID.' });
      return null;
    }
    const found = await findRentalItem(itemId);
    if (!found) {
      res.status(404).send({ message: 'Tool or equipment not found.' });
      return null;
    }
    if (!ACTIVE_RENTAL_STATUSES.includes(found.item.purchaseStatus)) {
      res.status(409).send({
        message: `This item is not an active rental (status: ${found.item.purchaseStatus}).`,
      });
      return null;
    }
    return found;
  };

  const requestorId = (req) => req.body?.requestor?.requestorId;

  const markReturned = async (req, res) => {
    try {
      const found = await loadActiveRental(req, res);
      if (!found) return;
      const { item, Model } = found;
      const now = new Date();

      const updated = await Model.findByIdAndUpdate(
        item._id,
        {
          $set: { purchaseStatus: 'Returned', rentalReturnedDate: now },
          $push: {
            rentalHistory: {
              action: 'Returned',
              date: now,
              createdBy: requestorId(req),
              previousDueDate: item.rentalDueDate,
            },
          },
        },
        { new: true, runValidators: true },
      ).populate(POPULATE);

      const returnedLate = Boolean(item.rentalDueDate) && now > new Date(item.rentalDueDate);
      res.status(200).send({ item: updated, returnedLate });
    } catch (error) {
      logException(error, 'bmRentalActionsController.markReturned', { itemId: req.params.itemId });
      res.status(500).send({ message: 'Could not mark the rental as returned.' });
    }
  };

  const extendRental = async (req, res) => {
    try {
      const newDue = new Date(req.body?.rentalDueDate);
      if (!req.body?.rentalDueDate || Number.isNaN(newDue.getTime())) {
        res.status(400).send({ message: 'A valid new due date (rentalDueDate) is required.' });
        return;
      }

      const found = await loadActiveRental(req, res);
      if (!found) return;
      const { item, Model } = found;

      if (newDue.getTime() <= Date.now()) {
        res.status(400).send({ message: 'The new due date must be in the future.' });
        return;
      }
      if (item.rentalDueDate && newDue.getTime() <= new Date(item.rentalDueDate).getTime()) {
        res.status(400).send({ message: 'The new due date must be after the current due date.' });
        return;
      }

      const updated = await Model.findByIdAndUpdate(
        item._id,
        {
          $set: { rentalDueDate: newDue },
          $push: {
            rentalHistory: {
              action: 'Extended',
              date: new Date(),
              createdBy: requestorId(req),
              previousDueDate: item.rentalDueDate,
              newDueDate: newDue,
            },
          },
        },
        { new: true, runValidators: true },
      ).populate(POPULATE);

      res.status(200).send({ item: updated });
    } catch (error) {
      logException(error, 'bmRentalActionsController.extendRental', { itemId: req.params.itemId });
      res.status(500).send({ message: 'Could not extend the rental.' });
    }
  };

  // Person to remind: whoever has it per the latest check-out, else the
  // item's responsible user.
  const responsibleUserId = (item) => {
    const lastCheckOut = [...(item.logRecord || [])]
      .reverse()
      .find((record) => record.type === 'Check Out' && record.responsibleUser);
    return lastCheckOut?.responsibleUser || item.userResponsible || null;
  };

  const sendReminder = async (req, res) => {
    try {
      const found = await loadActiveRental(req, res);
      if (!found) return;
      const { item, Model, kind } = found;

      const lastReminder = [...(item.rentalHistory || [])]
        .reverse()
        .find((entry) => entry.action === 'Reminder Sent');
      if (
        lastReminder &&
        Date.now() - new Date(lastReminder.date).getTime() < REMINDER_COOLDOWN_MS
      ) {
        res.status(429).send({
          message: 'A reminder was already sent for this item in the last 24 hours.',
        });
        return;
      }

      const userId = responsibleUserId(item);
      const user = userId
        ? await UserProfile.findById(userId).select('firstName lastName email').lean()
        : null;
      if (!user?.email) {
        res.status(422).send({
          message: 'No responsible person with an email address is recorded for this item.',
        });
        return;
      }

      const itemName = item.itemType?.name || (kind === 'tool' ? 'Tool' : 'Equipment');
      const projectName = item.project?.name || 'your project';
      const due = item.rentalDueDate ? formatDate(item.rentalDueDate) : 'soon';
      const overdue = item.rentalDueDate && new Date(item.rentalDueDate).getTime() < Date.now();
      const subject = `Rental return reminder: ${itemName}${overdue ? ' (overdue)' : ''}`;
      const message = `
        <p>Hi ${escapeHtml(user.firstName)},</p>
        <p>This is a reminder that the rented ${kind} <b>${escapeHtml(itemName)}</b>
        for <b>${escapeHtml(projectName)}</b> ${overdue ? 'was' : 'is'} due back on
        <b>${escapeHtml(due)}</b>.</p>
        <p>Please return it or ask your project manager to extend the rental.</p>
        <p>Thank you,<br/>One Community Building Management</p>`;

      const result = await emailSender(user.email, subject, message);
      // emailSender is a no-op outside production and resolves with this marker.
      const emailSent = result !== 'EMAIL_SENDING_DISABLED_NON_PROD';

      await Model.findByIdAndUpdate(item._id, {
        $push: {
          rentalHistory: {
            action: 'Reminder Sent',
            date: new Date(),
            createdBy: requestorId(req),
            sentTo: user._id,
          },
        },
      });

      res.status(200).send({
        sentTo: [user.firstName, user.lastName].filter(Boolean).join(' '),
        emailSent,
      });
    } catch (error) {
      logException(error, 'bmRentalActionsController.sendReminder', { itemId: req.params.itemId });
      res.status(500).send({ message: 'Could not send the reminder.' });
    }
  };

  return { markReturned, extendRental, sendReminder };
};

module.exports = bmRentalActionsController;
