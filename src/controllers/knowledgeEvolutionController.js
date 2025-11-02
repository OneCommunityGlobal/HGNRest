import mongoose from 'mongoose';
import studentTask from '../models/mockModels/studentTask';

const getKnowledgeEvolution = async (req, res) => {
  try {
    const studentId = req.params.id || req.user?.id;

    if (!studentId) {
      return res.status(400).json({ message: 'Student ID is required' });
    }

    const data = await studentTask.aggregate([
      {
        $match: { studentId: new mongoose.Types.ObjectId(studentId) },
      },

      {
        $lookup: {
          from: 'tasks',
          localField: 'taskId',
          foreignField: '_id',
          as: 'taskInfo',
        },
      },
      { $unwind: { path: '$taskInfo', preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: 'atoms',
          localField: 'taskInfo.atomId',
          foreignField: '_id',
          as: 'atomInfo',
        },
      },
      { $unwind: { path: '$atomInfo', preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: 'subjects',
          localField: 'atomInfo.subjectId',
          foreignField: '_id',
          as: 'subjectInfo',
        },
      },
      { $unwind: { path: '$subjectInfo', preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: 'grades',
          let: { tId: '$_id', sId: '$studentId' },
          pipeline: [
            {
              $match: {
                $expr: { $and: [{ $eq: ['$taskId', '$$tId'] }, { $eq: ['$studentId', '$$sId'] }] },
              },
            },
          ],
          as: 'gradeInfo',
        },
      },

      {
        $lookup: {
          from: 'studentatoms',
          let: { aId: '$atomInfo._id', sId: '$studentId' },
          pipeline: [
            {
              $match: {
                $expr: { $and: [{ $eq: ['$atomId', '$$aId'] }, { $eq: ['$studentId', '$$sId'] }] },
              },
            },
          ],
          as: 'studentAtomInfo',
        },
      },

      {
        $addFields: {
          averageGrade: { $avg: '$gradeInfo.score' },
          atomStatus: { $arrayElemAt: ['$studentAtomInfo.status', 0] },
        },
      },

      {
        $project: {
          _id: 1,
          subjectId: '$subjectInfo._id',
          subjectName: '$subjectInfo.name',
          atomId: '$atomInfo._id',
          atomName: '$atomInfo.name',
          atomColor: '$atomInfo.colorLevel',
          taskStatus: '$status',
          atomStatus: 1,
          grade: '$averageGrade',
        },
      },

      {
        $group: {
          _id: '$subjectId',
          subjectName: { $first: '$subjectName' },
          averageGrade: { $avg: '$grade' },
          atoms: {
            $push: {
              atomId: '$atomId',
              atomName: '$atomName',
              color: '$atomColor',
              atomStatus: '$atomStatus',
              taskStatus: '$taskStatus',
              grade: '$grade',
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

export default getKnowledgeEvolution;
