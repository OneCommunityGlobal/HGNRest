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
    const files = await Attachment.find({ equipment: equipmentId })
      .select('name category mimeType size uploader uploadedAt')
      .sort({ uploadedAt: -1, _id: -1 })
      .populate('uploader', 'firstName lastName')
      .lean();
    return res.json(files);
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
    const file = await Attachment.findOne({ _id: attachmentId, equipment: equipmentId }).select(
      'name mimeType +content',
    );
    if (!file) return res.status(404).json({ message: 'Attachment not found.' });
    return res
      .attachment(file.name)
      .type(file.mimeType)
      .set('X-Content-Type-Options', 'nosniff')
      .send(Buffer.from(file.content));
  });

  return { list, add, download };
}

module.exports = { equipmentAttachments, receiveAttachment };
