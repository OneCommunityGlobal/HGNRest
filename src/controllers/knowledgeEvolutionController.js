import mongoose from 'mongoose';
import atom from '../models/atom';

const getKnowledgeEvolution = async (req, res) => {
  try {
    const studentId = req.params.id || req.user.id;

    const data = await atom.aggregate([
      { $match: { studentId: new mongoose.Types.ObjectId(studentId) } },
      {
        $lookup: {
          from: 'atoms',
          localField: 'atomId',
          foreignField: '_id',
          as: 'atom',
        },
      },
      { $unwind: '$atom' },
      {
        $lookup: {
          from: 'subjects',
          localField: 'atom.subjectId',
          foreignField: '_id',
          as: 'subject',
        },
      },
      { $unwind: '$subject' },
      {
        $group: {
          _id: '$subject.subjectName',
          completedAtoms: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          inProgressAtoms: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          unearnedAtoms: { $sum: { $cond: [{ $eq: ['$status', 'not_started'] }, 1, 0] } },
          atoms: {
            $push: {
              atomName: '$atom.atomName',
              colorLevel: '$atom.colorLevel',
              status: '$status',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          subjectName: '$_id',
          completedAtoms: 1,
          inProgressAtoms: 1,
          unearnedAtoms: 1,
          atoms: 1,
        },
      },
    ]);

    return res.status(200).json({
      studentId,
      knowledgeEvolution: data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error fetching knowledge evolution data' });
  }
};

export default getKnowledgeEvolution;
