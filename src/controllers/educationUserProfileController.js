const mongoose = require('mongoose');
const UserProfile = require('../models/userProfile');
const EducationTask = require('../models/educationTask');
const Atom = require('../models/atom');
const LessonPlan = require('../models/lessonPlan');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * @desc    Get profile and educational progress for the authenticated student.
 * @route   GET /api/student/profile
 * @access  Private (Student)
 */
const getStudentProfile = async (req, res) => {
  // Assuming studentId is on req.user from an auth middleware
  const studentId = req.body.requestor.requestorId;

  if (!isValidObjectId(studentId)) {
    return res.status(400).send({ error: 'Invalid student ID provided.' });
  }

  try {
    // 1. Find the student's profile
    const user = await UserProfile.findById(studentId)
      .select(
        'firstName lastName profilePic createdDate timeZone location educationProfiles.student',
      )
      .lean(); // Use .lean() for a plain object

    if (!user || !user.educationProfiles || !user.educationProfiles.student) {
      return res.status(404).json({ msg: 'Student profile not found or is incomplete.' });
    }

    // 2. Find the assigned Educator (Teacher)
    // We look for an 'Educator' who has this student in their list
    const teacher = await UserProfile.findOne({
      role: 'Educator', // Using the role name you provided
      'educationProfiles.teacher.assignedStudents': user._id,
    })
      .select('firstName lastName')
      .lean();

    // 3. Find the assigned Learning Support team member
    // We look for a 'Learning Support' user assigned to that teacher
    let supportMember = null;
    if (teacher) {
      supportMember = await UserProfile.findOne({
        role: 'Learning Support', // Using the role name you provided
        'educationProfiles.learningSupport.assignedTeachers': teacher._id,
      })
        .select('firstName lastName')
        .lean();
    }

    // 4. Build the studentDetails object with dynamic names
    const studentDetails = {
      fullName: `${user.firstName} ${user.lastName}`,
      avatar: user.profilePic,
      studentId: user._id.toString(),
      teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : 'N/A',
      supportMemberName: supportMember
        ? `${supportMember.firstName} ${supportMember.lastName}`
        : 'N/A',
      gradeLevel: user.educationProfiles.student.learningLevel || 'N/A',
      location: user.location?.userProvided || 'N/A',
      dateJoined: user.createdDate,
      timezone: user.timeZone,
      portfolioLink: `/student/portfolio/${user._id}`,
    };

    // 5. Get the subject progress (This aggregation seems correct)
    const subjectProgress = await EducationTask.aggregate([
      {
        $match: { studentId: new mongoose.Types.ObjectId(studentId) },
      },
      {
        $unwind: '$atomIds',
      },
      {
        $lookup: {
          from: 'atoms',
          localField: 'atomIds',
          foreignField: '_id',
          as: 'atomDetail',
        },
      },
      {
        $unwind: '$atomDetail',
      },
      {
        $lookup: {
          from: 'subjects',
          localField: 'atomDetail.subjectId',
          foreignField: '_id',
          as: 'subjectDetail',
        },
      },
      {
        $unwind: '$subjectDetail',
      },
      {
        $group: {
          _id: '$subjectDetail._id',
          name: { $first: '$subjectDetail.name' },
          color: { $first: '$subjectDetail.color' },
          completed: {
            $sum: { $cond: [{ $in: ['$status', ['completed', 'graded']] }, 1, 0] },
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] },
          },
          remaining: {
            $sum: { $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          name: '$name',
          color: { $ifNull: ['$color', '#777B7E'] },
          completed: '$completed',
          inProgress: '$inProgress',
          remaining: '$remaining',
          totalTasks: { $add: ['$completed', '$inProgress', '$remaining'] },
          completionPercentage: {
            $cond: [
              { $eq: [{ $add: ['$completed', '$inProgress', '$remaining'] }, 0] },
              0, // If total is 0, percentage is 0
              {
                // Otherwise, calculate (completed / total) * 100
                $multiply: [
                  {
                    $divide: ['$completed', { $add: ['$completed', '$inProgress', '$remaining'] }],
                  },
                  100,
                ],
              },
            ],
          },
        },
      },
    ]);

    // 6. Send the final response
    res.status(200).json({
      studentDetails,
      subjects: subjectProgress,
    });
  } catch (err) {
    console.error('Error in getStudentProfile:', err.message);
    res.status(500).send({ error: 'Server Error' });
  }
};

// /**
//  * @desc    Get profile and educational progress for the authenticated student.
//  * @route   GET /api/student/profile
//  * @access  Private (Student)
//  */
// const getStudentProfile = async (req, res) => {
//   const studentId = req.body.requestor.requestorId;

//   if (!isValidObjectId(studentId)) {
//     return res.status(400).send({ error: 'Invalid student ID provided.' });
//   }

//   try {
//     const user = await UserProfile.findById(studentId).select(
//       'firstName lastName profilePic createdDate timeZone location educationProfiles.student',
//     );

//     if (!user || !user.educationProfiles || !user.educationProfiles.student) {
//       return res.status(404).json({ msg: 'Student profile not found or is incomplete.' });
//     }

//     const studentDetails = {
//       fullName: `${user.firstName} ${user.lastName}`,
//       avatar: user.profilePic,
//       studentId: user._id.toString(),
//       teacherName: 'Ms. Wilson (Placeholder)' ,
//       supportMemberName: 'Dr. Chen (Placeholder)',
//       gradeLevel: user.educationProfiles.student.learningLevel || 'N/A',
//       location: user.location?.userProvided || 'N/A',
//       dateJoined: user.createdDate,
//       timezone: user.timeZone,
//       portfolioLink: `/student/portfolio/${user._id}`,
//     };

//     const subjectProgress = await EducationTask.aggregate([
//       {
//         $match: { studentId: new mongoose.Types.ObjectId(studentId) },
//       },

//       {
//         $lookup: {
//           from: 'atoms',
//           localField: 'atomId', // Use singular atomId
//           foreignField: '_id',
//           as: 'atomDetail',
//         },
//       },
//       {
//         $unwind: '$atomDetail',
//       },

//       {
//         $lookup: {
//           from: 'subjects',
//           localField: 'atomDetail.subjectId',
//           foreignField: '_id',
//           as: 'subjectDetail',
//         },
//       },
//       {
//         $unwind: '$subjectDetail',
//       },

//       {
//         $group: {
//           _id: '$subjectDetail._id',
//           name: { $first: '$subjectDetail.name' },
//           color: { $first: '$subjectDetail.colorCode' },
//           completed: {
//             $sum: { $cond: [{ $in: ['$status', ['completed', 'graded']] }, 1, 0] },
//           },
//           inProgress: {
//             $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] },
//           },
//           remaining: {
//             $sum: { $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0] },
//           },
//         },
//       },

//       {
//         $project: {
//           _id: 0,
//           id: '$_id',
//           name: '$name',
//           color: { $ifNull: ['$color', '#E0E0E0'] },
//           completed: '$completed',
//           inProgress: '$inProgress',
//           remaining: '$remaining',
//         },
//       },
//     ]);

//     res.status(200).json({
//       studentDetails,
//       subjects: subjectProgress,
//     });
//   } catch (err) {
//     console.error('Error in getStudentProfile:', err.message);
//     res.status(500).send({ error: 'Server Error' });
//   }
// };

/**
 * @desc    Update personal details for the authenticated student.
 * @route   PUT /api/student/profile
 * @access  Private (Student)
 */
const updateStudentProfile = async (req, res) => {
  const studentId = req.body.requestor.requestorId;
  const { location, timeZone, bio, personalLinks } = req.body;

  if (!isValidObjectId(studentId)) {
    return res.status(400).send({ error: 'Invalid student ID.' });
  }

  try {
    const user = await UserProfile.findById(studentId);

    if (!user) {
      return res.status(404).json({ msg: 'Student profile not found.' });
    }

    if (location) user.location = location;
    if (timeZone) user.timeZone = timeZone;
    if (bio) user.bio = bio;
    if (personalLinks) user.personalLinks = personalLinks;

    user.lastModifiedDate = Date.now();

    const updatedUser = await user.save();

    res.status(200).json({
      msg: 'Profile updated successfully.',
      user: {
        location: updatedUser.location,
        timeZone: updatedUser.timeZone,
        bio: updatedUser.bio,
        personalLinks: updatedUser.personalLinks,
      },
    });
  } catch (err) {
    console.error('Error in updateStudentProfile:', err.message);
    res.status(500).send({ error: 'Server Error' });
  }
};

/**
 * @desc    Get a detailed task breakdown for a specific subject.
 * @route   GET /api/student/profile/subject/:subjectId
 * @access  Private (Student)
 */
const getSubjectTasks = async (req, res) => {
  const studentId = req.body.requestor.requestorId;
  const { id: subjectId } = req.params;

  console.log(studentId);
  console.log(subjectId);

  if (!isValidObjectId(studentId) || !isValidObjectId(subjectId)) {
    return res.status(400).send({ error: 'Invalid ID provided for student or subject.' });
  }

  try {
    const now = new Date();
    const activePlans = await LessonPlan.find({
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).select('_id');

    console.log(activePlans);

    const activePlanIds = activePlans.map((plan) => plan._id);

    if (activePlanIds.length === 0) {
      return res.status(200).json([]);
    }

    const atomsInSubject = await Atom.find({ subjectId }).select('_id');
    const atomIds = atomsInSubject.map((atom) => atom._id);

    console.log(atomsInSubject);
    console.log(atomIds);

    if (atomIds.length === 0) {
      return res.status(200).json([]);
    }

    const queryConditions = {
      studentId: new mongoose.Types.ObjectId(studentId),
      lessonPlanId: { $in: activePlanIds },
      atomIds: { $in: atomIds },
    };
    console.log(
      'Query Conditions for EducationTask.find:',
      JSON.stringify(queryConditions, null, 2),
    );
    const rawTasks = await EducationTask.find(queryConditions);
    console.log('Raw Tasks Found:', rawTasks);

    const tasks = await EducationTask.find({
      studentId: new mongoose.Types.ObjectId(studentId), // Explicitly cast to ObjectId
      lessonPlanId: { $in: activePlanIds },
      atomIds: { $in: atomIds },
    })
      .populate({
        path: 'atomIds',
        select: 'name description difficulty subjectId',
      })
      .sort({ dueAt: 1 });

    console.log('Final Tasks Result:', tasks);

    res.status(200).json(tasks);
  } catch (err) {
    console.error('Error in getSubjectTasks:', err.message);
    res.status(500).send({ error: 'Server Error' });
  }
};

module.exports = {
  getStudentProfile,
  updateStudentProfile,
  getSubjectTasks,
};
