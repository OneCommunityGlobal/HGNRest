const mongoose = require('mongoose');
const Progress = require('../../models/progress');

exports.getKnowledgeEvolution = async (req, res) => {
  try {
    const studentId = req.query.studentId || req.body?.requestor?.requestorId;

    if (!studentId) {
      return res.status(400).json({ message: 'studentId is required' });
    }

    const data = await Progress.aggregate([
      {
        $match: {
          studentId: new mongoose.Types.ObjectId(studentId),
        },
      },

      {
        $lookup: {
          from: 'atoms',
          localField: 'atomId',
          foreignField: '_id',
          as: 'atomInfo',
        },
      },
      { $unwind: '$atomInfo' },

      {
        $lookup: {
          from: 'subjects',
          localField: 'atomInfo.subjectId',
          foreignField: '_id',
          as: 'subjectInfo',
        },
      },
      { $unwind: '$subjectInfo' },

      {
        $group: {
          _id: '$subjectInfo._id',
          subjectName: { $first: '$subjectInfo.name' },
          atoms: {
            $push: {
              atomId: '$atomInfo._id',
              atomName: '$atomInfo.name',
              color: '$atomInfo.difficulty',
              atomStatus: '$status',
            },
          },
        },
      },

      {
        $addFields: {
          totalAtoms: { $size: '$atoms' },
          completedAtoms: {
            $size: {
              $filter: {
                input: '$atoms',
                as: 'a',
                cond: { $eq: ['$$a.atomStatus', 'completed'] },
              },
            },
          },
          inProgressAtoms: {
            $size: {
              $filter: {
                input: '$atoms',
                as: 'a',
                cond: { $eq: ['$$a.atomStatus', 'in_progress'] },
              },
            },
          },
        },
      },

      { $sort: { subjectName: 1 } },
    ]);

    res.status(200).json({
      studentId,
      message: 'Knowledge evolution data fetched successfully',
      totalSubjects: data.length,
      knowledgeEvolution: data,
    });
  } catch (error) {
    console.error('Error in getKnowledgeEvolution:', error);
    res.status(500).json({
      message: 'Error fetching learner knowledge evolution data',
      error: error.message,
    });
  }
};
