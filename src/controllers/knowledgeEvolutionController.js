import mongoose from 'mongoose';
import studentTask from '../models/mockModels/studentTask';
// import studentAtom from '../models/mockModels/studentAtom.js';
// import grade from '../models/mockModels/grade.js';
// import subject from '../models/subject.js';

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
          from: 'studentatoms',
          localField: 'atomId',
          foreignField: '_id',
          as: 'atom',
        },
      },
      { $unwind: { path: '$atom', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'subjects',
          localField: 'atom.subjectId',
          foreignField: '_id',
          as: 'subject',
        },
      },
      { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'grades',
          localField: '_id',
          foreignField: 'taskId',
          as: 'grades',
        },
      },
      {
        $addFields: {
          averageGrade: { $avg: '$grades.score' },
        },
      },
      {
        $project: {
          _id: 1,
          subjectId: '$subject._id',
          subjectName: '$subject.name',
          atomId: '$atom._id',
          atomName: '$atom.name',
          atomColor: '$atom.colorLevel',
          status: '$status',
          grade: '$grades.score',
          averageGrade: 1,
        },
      },
      {
        $group: {
          _id: '$subjectId',
          subjectName: { $first: '$subjectName' },
          averageGrade: { $avg: '$averageGrade' },
          atoms: {
            $push: {
              atomId: '$atomId',
              atomName: '$atomName',
              color: '$atomColor',
              status: '$status',
              grade: '$averageGrade',
            },
          },
        },
      },
      {
        $sort: { subjectName: 1 },
      },
    ]);

    res.status(200).json({
      studentId,
      message: 'Knowledge evolution data',
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
