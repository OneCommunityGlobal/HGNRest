const mongoose = require('mongoose');
const multer = require('multer');
const Attachment = require('../../models/bmdashboard/equipmentAttachment');
const { logException } = require('../../startup/logger');

const categories = ['Invoice', 'Rental agreement', 'Inspection report'];
const fileTypes = {
  'application/pdf': { extension: /\.pdf$/i, header: '255044462d' },
  'image/jpeg': { extension: /\.jpe?g$/i, header: 'ffd8ff' },
  'image/png': { extension: /\.png$/i, header: '89504e470d0a1a0a' },
};
const uploadError = 'Choose a PDF, JPG or PNG file up to 5 MB.';
const active = { removedAt: null };
const parseAttachment = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1, fieldSize: 64 },
}).single('file');

function receiveAttachment(req, res, next) {
  if (!req.is('multipart/form-data')) return res.status(400).json({ message: uploadError });
  return parseAttachment(req, res, (error) => {
    if (error) return res.status(400).json({ message: uploadError });
    return next();
  });
}

function validFile(file) {
  if (!file || !Object.hasOwn(fileTypes, file.mimetype)) return false;
  const { extension, header } = fileTypes[file.mimetype];
  return (
    extension.test(file.originalname) &&
    file.buffer.subarray(0, header.length / 2).equals(Buffer.from(header, 'hex'))
  );
}

function equipmentAttachments(Equipment) {
  const handle = (action) => async (req, res) => {
    const { equipmentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(equipmentId)) {
      return res.status(400).json({ message: 'Invalid equipment ID.' });
    }
    try {
      if (!(await Equipment.exists({ _id: equipmentId }))) {
        return res.status(404).json({ message: 'Equipment not found.' });
      }
      res.set('Cache-Control', 'private, no-store');
      return await action(req, res, equipmentId);
    } catch (error) {
      logException(error, 'equipmentAttachments');
      return res.status(500).json({ message: 'Unable to process the attachment request.' });
    }
  };

  const list = handle(async (req, res, equipmentId) => {
    const documents = await Attachment.find({ equipment: equipmentId })
      .select('name category mimeType size uploader uploadedAt removedAt changes')
      .sort({ uploadedAt: -1, _id: -1 })
      .populate([
        { path: 'uploader', select: 'firstName lastName' },
        { path: 'changes.actor', select: 'firstName lastName' },
      ])
      .lean();
    const files = [];
    const auditHistory = [];
    documents.forEach(({ removedAt, changes, ...file }) => {
      if (!removedAt) files.push(file);
      if (file.uploadedAt) {
        auditHistory.push({
          _id: `attachment-upload-${file._id}`,
          field: 'Attachment uploaded',
          timestamp: file.uploadedAt,
          actor: file.uploader,
          newValue: file.name,
        });
      }
      auditHistory.push(...(changes || []));
    });
    return res.json({ files, auditHistory });
  });

  const add = handle(async (req, res, equipmentId) => {
    const { file } = req;
    const { category } = req.body;
    if (!categories.includes(category)) {
      return res.status(400).json({ message: 'Choose an attachment category.' });
    }
    if (!validFile(file)) return res.status(400).json({ message: uploadError });
    const name = Array.from(file.originalname.normalize('NFC'))
      .map((character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? '_' : character,
      )
      .join('')
      .slice(-255);
    await Attachment.create({
      equipment: equipmentId,
      name,
      category,
      mimeType: file.mimetype,
      size: file.size,
      uploader: req.user.requestorId,
      content: file.buffer,
    });
    return res.sendStatus(201);
  });

  const download = handle(async (req, res, equipmentId) => {
    const { attachmentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(attachmentId)) {
      return res.status(404).json({ message: 'Attachment not found.' });
    }
    const file = await Attachment.findOne({
      _id: attachmentId,
      equipment: equipmentId,
      ...active,
    }).select('name mimeType +content');
    if (!file) return res.status(404).json({ message: 'Attachment not found.' });
    return res
      .attachment(file.name)
      .type(file.mimeType)
      .set('X-Content-Type-Options', 'nosniff')
      .send(Buffer.from(file.content));
  });

  const change = (remove) =>
    handle(async (req, res, equipmentId) => {
      const { attachmentId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(attachmentId)) {
        return res.status(404).json({ message: 'Attachment not found.' });
      }
      const { category, originalCategory } = req.body;
      if (!remove && !categories.includes(category)) {
        return res.status(400).json({ message: 'Choose an attachment category.' });
      }
      const filter = { _id: attachmentId, equipment: equipmentId, ...active };
      const file = await Attachment.findOne(filter).select('name category').lean();
      if (!file) return res.status(404).json({ message: 'Attachment not found.' });
      const conflict = () =>
        res.status(409).json({ message: 'The attachment changed. Reload and try again.' });
      if (!remove && originalCategory !== file.category) return conflict();
      if (!remove && category === file.category) return res.sendStatus(204);
      const timestamp = new Date();
      const audit = {
        timestamp,
        actor: req.user.requestorId,
        field: remove ? 'Attachment removed' : `Attachment category (${file.name})`,
        oldValue: remove ? file.name : file.category,
        newValue: remove ? null : category,
      };
      const update = remove
        ? { $set: { removedAt: timestamp }, $unset: { content: 1 } }
        : { $set: { category } };
      const result = await Attachment.updateOne(
        { ...filter, category: file.category },
        {
          ...update,
          $push: { changes: audit },
        },
      );
      return result.n ? res.sendStatus(204) : conflict();
    });

  return { list, add, download, edit: change(false), remove: change(true) };
}

module.exports = { equipmentAttachments, receiveAttachment };
