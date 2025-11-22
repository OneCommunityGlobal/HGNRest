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
          from: 'educationtasks',
          localField: 'taskId',
          foreignField: '_id',
          as: 'taskInfo',
        },
      },
      { $unwind: '$taskInfo' },

      {
        $lookup: {
          from: 'atoms',
          localField: 'taskInfo.atomIds',
          foreignField: '_id',
          as: 'atomInfo',
        },
      },

      {
        $lookup: {
          from: 'subjects',
          localField: 'atomInfo.subjectId',
          foreignField: '_id',
          as: 'subjectInfo',
        },
      },

      {
        $lookup: {
          from: 'studentatoms',
          let: { atomIds: '$taskInfo.atomIds', stuId: '$studentId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $in: ['$atomId', '$$atomIds'] }, { $eq: ['$studentId', '$$stuId'] }],
                },
              },
            },
          ],
          as: 'studentAtomInfo',
        },
      },

      {
        $addFields: {
          atoms: {
            $map: {
              input: '$atomInfo',
              as: 'atom',
              in: {
                atomId: '$$atom._id',
                atomName: '$$atom.name',
                color: '$$atom.difficulty',
                atomStatus: {
                  $ifNull: [
                    {
                      $arrayElemAt: [
                        {
                          $map: {
                            input: {
                              $filter: {
                                input: '$studentAtomInfo',
                                as: 'sa',
                                cond: { $eq: ['$$sa.atomId', '$$atom._id'] },
                              },
                            },
                            as: 'sa',
                            in: '$$sa.status',
                          },
                        },
                        0,
                      ],
                    },
                    'not_started',
                  ],
                },
                taskStatus: '$status',
              },
            },
          },
        },
      },

      {
        $unwind: '$atoms',
      },
      {
        $group: {
          _id: '$atoms.atomId',
          subjectId: { $first: { $arrayElemAt: ['$subjectInfo._id', 0] } },
          subjectName: { $first: { $arrayElemAt: ['$subjectInfo.name', 0] } },
          atoms: { $push: '$atoms' },
        },
      },

      {
        $group: {
          _id: '$subjectId',
          subjectName: { $first: '$subjectName' },
          atoms: { $push: { $arrayElemAt: ['$atoms', 0] } },
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
