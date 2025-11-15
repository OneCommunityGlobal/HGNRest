const mongoose = require('mongoose');
const StudentTask = require('../models/bmdashboard/studentTask');

exports.getKnowledgeEvolution = async (req, res) => {
  try {
    const studentId = req.query.studentId || req.user?.id;

    if (!studentId) {
      return res.status(400).json({ message: 'studentId is required' });
    }

    const data = await StudentTask.aggregate([
      {
        $match: {
          studentId: new mongoose.Types.ObjectId(studentId),
        },
      },

      {
        $lookup: {
          from: 'tasks',
          localField: 'taskId',
          foreignField: '_id',
          as: 'taskInfo',
        },
      },
      { $unwind: { path: '$taskInfo', preserveNullAndEmptyArrays: false } },

      {
        $lookup: {
          from: 'atoms',
          localField: 'taskInfo.atomId',
          foreignField: '_id',
          as: 'atomInfo',
        },
      },
      { $unwind: { path: '$atomInfo', preserveNullAndEmptyArrays: false } },

      {
        $lookup: {
          from: 'subjects',
          localField: 'atomInfo.subjectId',
          foreignField: '_id',
          as: 'subjectInfo',
        },
      },
      { $unwind: { path: '$subjectInfo', preserveNullAndEmptyArrays: false } },

      {
        $lookup: {
          from: 'studentatoms',
          let: {
            atomIdVar: '$atomInfo._id',
            stuIdVar: '$studentId',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$atomId', '$$atomIdVar'] },
                    { $eq: ['$studentId', '$$stuIdVar'] },
                  ],
                },
              },
            },
          ],
          as: 'studentAtomInfo',
        },
      },

      // Extract mastery status safely
      {
        $addFields: {
          atomStatus: {
            $ifNull: [{ $arrayElemAt: ['$studentAtomInfo.status', 0] }, 'not_started'],
          },
        },
      },

      {
        $project: {
          subjectId: '$subjectInfo._id',
          subjectName: '$subjectInfo.name',

          atomId: '$atomInfo._id',
          atomName: '$atomInfo.name',
          atomColor: '$atomInfo.difficulty',

          atomStatus: 1,
          taskStatus: '$status',
        },
      },

      {
        $group: {
          _id: '$subjectId',
          subjectName: { $first: '$subjectName' },
          atoms: {
            $push: {
              atomId: '$atomId',
              atomName: '$atomName',
              color: '$atomColor',
              atomStatus: '$atomStatus',
              taskStatus: '$taskStatus',
            },
          },
        },
      },

      { $sort: { subjectName: 1 } },

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
