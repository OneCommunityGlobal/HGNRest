import mongoose from 'mongoose';
import studentTask from '../models/mockModels/studentTask';
// import studentAtom from "../models/mockModels/studentAtom";
// import grade from "../models/mockModels/grade";
// import subject from "../models/subject";

const getKnowledgeEvolution = async (req, res) => {
  try {
    const studentId = req.params.id || req.user?.id;

    if (!studentId) {
      return res.status(400).json({ message: 'Student ID is required' });
    }

    const data = await studentTask.aggregate([
      {
        $match: {
          studentId: new mongoose.Types.ObjectId(studentId),
        },
      },

      {
        $lookup: {
          from: 'studentAtom',
          localField: 'atomId',
          foreignField: '_id',
          as: 'atom',
        },
      },
      { $unwind: { path: '$atom', preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: 'subject',
          localField: 'atom.subjectId',
          foreignField: '_id',
          as: 'subject',
        },
      },
      { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },

      // to do:lookup grades and calculate average grades
      {
        $project: {
          _id: 1,
          subjectName: '$subject.name',
          atomName: '$atom.name',
          atomColor: '$atom.colorLevel',
          status: '$status',
          grade: null,
          averageGrade: null,
        },
      },
    ]);

    // temp response
    res.status(200).json({
      studentId,
      message: 'Knowledge evolution data (partial)',
      count: data.length,
      knowledgeEvolution: data,
    });
  } catch (error) {
    console.error('Error in getKnowledgeEvolution:', error);
    res.status(500).json({
      message: 'Error fetching learner knowledge evolution data (partial)',
    });
  }
};

export default getKnowledgeEvolution;
