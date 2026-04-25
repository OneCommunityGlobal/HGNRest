const mongoose = require('mongoose');
const Progress = require('../models/progress');
const UserProfile = require('../models/userProfile');
const Atom = require('../models/atom');
const EducationStudentProfile = require('../models/educationStudentProfile');

const normalizeToArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [value];
};

const buildManualStudentProgressResponse = (profile) => {
  const completedAtoms = [];
  const inProgressAtoms = [];
  const notStartedAtoms = [];

  const subjects = Array.isArray(profile.subjects) ? profile.subjects : [];

  subjects.forEach((subject) => {
    const subjectName = subject?.name || 'General';
    const molecules = Array.isArray(subject?.molecules) ? subject.molecules : [];

    molecules.forEach((molecule, index) => {
      const status = molecule?.status || 'not_started';
      const fallbackId = `${subjectName}-${molecule?.label || molecule?.name || index}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');

      const atomData = {
        atomId: molecule?.atomId || fallbackId,
        name: molecule?.label || molecule?.name || `Molecule ${index + 1}`,
        description: molecule?.description || '',
        difficulty: molecule?.difficulty || 'medium',
        moleculeType: molecule?.moleculeType || subjectName,
        subject: subjectName,
        status,
        grade: molecule?.grade || (status === 'completed' ? 'A' : 'pending'),
        timestamp:
          molecule?.completedAt ||
          molecule?.startedAt ||
          profile?.updatedAt ||
          profile?.createdAt ||
          null,
        sourceTask: molecule?.sourceTask
          ? {
              reference: molecule.sourceTask,
              taskType: molecule?.taskType || null,
              lessonPlan: molecule?.lessonPlan || null,
              assignedAt: molecule?.assignedAt || null,
              completedAt: molecule?.completedAt || null,
            }
          : null,
      };

      if (status === 'completed') {
        completedAtoms.push(atomData);
      } else if (status === 'in_progress') {
        inProgressAtoms.push(atomData);
      } else {
        notStartedAtoms.push(atomData);
      }
    });
  });

  const summaryTotals = profile?.progressSummary || {};
  const totalAtomsFallback =
    completedAtoms.length + inProgressAtoms.length + notStartedAtoms.length;

  return {
    student: {
      id: profile._id,
      firstName: profile?.firstName || (profile?.name ? profile.name.split(' ')[0] : 'Student'),
      lastName:
        profile?.lastName || (profile?.name ? profile.name.split(' ').slice(1).join(' ') : ''),
      email: profile?.email || '',
      profilePic: profile?.avatarUrl || null,
      location: profile?.location || '',
      educationProfile: {
        learningLevel: profile?.gradeLevel || profile?.learningLevel || null,
        strengths: normalizeToArray(
          profile?.strengths ||
            profile?.educationProfile?.student?.strengths ||
            profile?.student?.strengths,
        ),
        challengingAreas: normalizeToArray(
          profile?.challengingAreas ||
            profile?.educationProfile?.student?.challengingAreas ||
            profile?.student?.challengingAreas,
        ),
      },
    },
    progress: {
      completed: completedAtoms,
      inProgress: inProgressAtoms,
      notStarted: notStartedAtoms,
    },
    summary: {
      totalCompleted: summaryTotals.totalCompleted ?? completedAtoms.length,
      totalInProgress: summaryTotals.totalInProgress ?? inProgressAtoms.length,
      totalNotStarted: summaryTotals.totalNotStarted ?? notStartedAtoms.length,
      totalAtoms: summaryTotals.totalAtoms ?? totalAtomsFallback,
    },
  };
};

const progressController = function () {
  // Get all progress records
  const getProgress = async (req, res) => {
    try {
      const progress = await Progress.find({})
        .populate('studentId', 'firstName lastName email')
        .populate('atomId', 'name description difficulty')
        .sort({ createdAt: -1 });
      res.status(200).json(progress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get progress by student
  const getProgressByStudent = async (req, res) => {
    try {
      const { studentId } = req.params;
      const progress = await Progress.find({ studentId })
        .populate('studentId', 'firstName lastName email')
        .populate('atomId', 'name description difficulty')
        .sort({ createdAt: -1 });
      res.status(200).json(progress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get progress by atom
  const getProgressByAtom = async (req, res) => {
    try {
      const { atomId } = req.params;
      const progress = await Progress.find({ atomId })
        .populate('studentId', 'firstName lastName email')
        .populate('atomId', 'name description difficulty')
        .sort({ createdAt: -1 });
      res.status(200).json(progress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get specific progress record
  const getProgressById = async (req, res) => {
    try {
      const { id } = req.params;
      const progress = await Progress.findById(id)
        .populate('studentId', 'firstName lastName email')
        .populate('atomId', 'name description difficulty');

      if (!progress) {
        return res.status(404).json({ error: 'Progress record not found' });
      }

      res.status(200).json(progress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get progress by student and atom
  const getProgressByStudentAndAtom = async (req, res) => {
    try {
      const { studentId, atomId } = req.params;
      const progress = await Progress.findOne({ studentId, atomId })
        .populate('studentId', 'firstName lastName email')
        .populate('atomId', 'name description difficulty');

      if (!progress) {
        return res.status(404).json({ error: 'Progress record not found' });
      }

      res.status(200).json(progress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Create new progress record
  const createProgress = async (req, res) => {
    try {
      const { studentId, atomId, status, grade, feedback } = req.body;

      // Validate student exists
      const student = await UserProfile.findById(studentId);
      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Validate atom exists
      const atom = await Atom.findById(atomId);
      if (!atom) {
        return res.status(404).json({ error: 'Atom not found' });
      }

      // Check if progress record already exists
      const existingProgress = await Progress.findOne({ studentId, atomId });
      if (existingProgress) {
        return res
          .status(400)
          .json({ error: 'Progress record already exists for this student and atom' });
      }

      const progress = new Progress({
        studentId,
        atomId,
        status: status || 'not_started',
        grade: grade || 'pending',
        feedback,
      });

      const savedProgress = await progress.save();
      const populatedProgress = await Progress.findById(savedProgress._id)
        .populate('studentId', 'firstName lastName email')
        .populate('atomId', 'name description difficulty');

      res.status(201).json(populatedProgress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Update progress
  const updateProgress = async (req, res) => {
    try {
      const { id } = req.params;
      const { status, grade, feedback } = req.body;

      const progress = await Progress.findById(id);
      if (!progress) {
        return res.status(404).json({ error: 'Progress record not found' });
      }

      // Validate status if provided
      if (status) {
        const validStatuses = ['not_started', 'in_progress', 'completed'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({
            error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          });
        }
      }

      // Validate grade if provided
      if (grade) {
        const validGrades = ['A', 'B', 'C', 'D', 'F', 'pending'];
        if (!validGrades.includes(grade)) {
          return res.status(400).json({
            error: `Invalid grade. Must be one of: ${validGrades.join(', ')}`,
          });
        }
      }

      // Update firstStartedAt if status is being changed to in_progress
      let { firstStartedAt } = progress;
      if (status === 'in_progress' && progress.status === 'not_started') {
        firstStartedAt = new Date();
      }

      // Update completedAt if status is being changed to completed
      let { completedAt } = progress;
      if (status === 'completed' && progress.status !== 'completed') {
        completedAt = new Date();
      }

      const updatedProgress = await Progress.findByIdAndUpdate(
        id,
        {
          status,
          grade,
          feedback,
          firstStartedAt,
          completedAt,
        },
        { new: true, runValidators: true },
      )
        .populate('studentId', 'firstName lastName email')
        .populate('atomId', 'name description difficulty');

      res.status(200).json(updatedProgress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Delete progress
  const deleteProgress = async (req, res) => {
    try {
      const { id } = req.params;

      const progress = await Progress.findByIdAndDelete(id);
      if (!progress) {
        return res.status(404).json({ error: 'Progress record not found' });
      }

      res.status(200).json({ message: 'Progress record deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Update progress status
  const updateProgressStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const progress = await Progress.findById(id);
      if (!progress) {
        return res.status(404).json({ error: 'Progress record not found' });
      }

      const validStatuses = ['not_started', 'in_progress', 'completed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        });
      }

      // Update firstStartedAt if status is being changed to in_progress
      let { firstStartedAt } = progress;
      if (status === 'in_progress' && progress.status === 'not_started') {
        firstStartedAt = new Date();
      }

      // Update completedAt if status is being changed to completed
      let { completedAt } = progress;
      if (status === 'completed' && progress.status !== 'completed') {
        completedAt = new Date();
      }

      const updatedProgress = await Progress.findByIdAndUpdate(
        id,
        { status, firstStartedAt, completedAt },
        { new: true },
      )
        .populate('studentId', 'firstName lastName email')
        .populate('atomId', 'name description difficulty');

      res.status(200).json(updatedProgress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Grade progress
  const gradeProgress = async (req, res) => {
    try {
      const { id } = req.params;
      const { grade, feedback } = req.body;

      const progress = await Progress.findById(id);
      if (!progress) {
        return res.status(404).json({ error: 'Progress record not found' });
      }

      const validGrades = ['A', 'B', 'C', 'D', 'F', 'pending'];
      if (!validGrades.includes(grade)) {
        return res.status(400).json({
          error: `Invalid grade. Must be one of: ${validGrades.join(', ')}`,
        });
      }

      const updatedProgress = await Progress.findByIdAndUpdate(
        id,
        { grade, feedback },
        { new: true },
      )
        .populate('studentId', 'firstName lastName email')
        .populate('atomId', 'name description difficulty');

      res.status(200).json(updatedProgress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get progress by status
  const getProgressByStatus = async (req, res) => {
    try {
      const { status } = req.params;
      const progress = await Progress.find({ status })
        .populate('studentId', 'firstName lastName email')
        .populate('atomId', 'name description difficulty')
        .sort({ createdAt: -1 });
      res.status(200).json(progress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get student progress summary
  const getStudentProgressSummary = async (req, res) => {
    try {
      const { studentId } = req.params;

      const progress = await Progress.find({ studentId })
        .populate('atomId', 'name description difficulty subjectId')
        .populate('atomId.subjectId', 'name');

      const summary = {
        total: progress.length,
        notStarted: progress.filter((p) => p.status === 'not_started').length,
        inProgress: progress.filter((p) => p.status === 'in_progress').length,
        completed: progress.filter((p) => p.status === 'completed').length,
        grades: {
          A: progress.filter((p) => p.grade === 'A').length,
          B: progress.filter((p) => p.grade === 'B').length,
          C: progress.filter((p) => p.grade === 'C').length,
          D: progress.filter((p) => p.grade === 'D').length,
          F: progress.filter((p) => p.grade === 'F').length,
          pending: progress.filter((p) => p.grade === 'pending').length,
        },
      };

      res.status(200).json(summary);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get educator view of student progress with molecules (atoms)
  const getEducatorStudentProgress = async (req, res) => {
    try {
      const { studentId } = req.params;

      let manualProfile = null;
      if (mongoose.Types.ObjectId.isValid(studentId)) {
        manualProfile = await EducationStudentProfile.findById(studentId).lean();
      }

      if (manualProfile) {
        const response = buildManualStudentProgressResponse(manualProfile);
        return res.status(200).json(response);
      }

      const EducationTask = require('../models/educationTask');

      // Validate student exists
      const student = await UserProfile.findById(studentId).select(
        'firstName lastName email educationProfiles profilePic location',
      );

      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Get all atoms and their progress for this student
      const progressRecords = await Progress.find({ studentId })
        .populate({
          path: 'atomId',
          select: 'name description difficulty subjectId moleculeType',
          populate: {
            path: 'subjectId',
            select: 'name',
          },
        })
        .sort({ updatedAt: -1 });

      // Get all tasks for this student to find source task info
      const tasks = await EducationTask.find({ studentId })
        .populate('lessonPlanId', 'title theme')
        .populate('atomIds', 'name');

      // Create a map of atomId to task info
      const atomToTaskMap = {};
      tasks.forEach((task) => {
        if (task.atomIds && task.atomIds.length > 0) {
          task.atomIds.forEach((atom) => {
            if (!atomToTaskMap[atom._id]) {
              atomToTaskMap[atom._id] = {
                taskId: task._id,
                taskType: task.type,
                lessonPlan: task.lessonPlanId ? task.lessonPlanId.title : null,
                assignedAt: task.assignedAt,
                completedAt: task.completedAt,
              };
            }
          });
        }
      });

      // Categorize atoms by status
      const completedAtoms = [];
      const inProgressAtoms = [];
      const notStartedAtoms = [];

      progressRecords.forEach((progress) => {
        if (!progress.atomId) return;

        const atomData = {
          atomId: progress.atomId._id,
          name: progress.atomId.name,
          description: progress.atomId.description,
          difficulty: progress.atomId.difficulty,
          moleculeType: progress.atomId.moleculeType,
          subject: progress.atomId.subjectId ? progress.atomId.subjectId.name : null,
          status: progress.status,
          grade: progress.grade,
          timestamp: progress.updatedAt,
          sourceTask: atomToTaskMap[progress.atomId._id] || null,
        };

        if (progress.status === 'completed') {
          completedAtoms.push(atomData);
        } else if (progress.status === 'in_progress') {
          inProgressAtoms.push(atomData);
        } else {
          notStartedAtoms.push(atomData);
        }
      });

      // Get all atoms to show unearned ones
      const allAtoms = await Atom.find({})
        .populate('subjectId', 'name')
        .select('name description difficulty moleculeType subjectId');

      // Find unearned atoms (atoms not in progress records)
      const progressAtomIds = progressRecords.map((p) => p.atomId?._id.toString()).filter(Boolean);
      const unearnedAtoms = allAtoms
        .filter((atom) => !progressAtomIds.includes(atom._id.toString()))
        .map((atom) => ({
          atomId: atom._id,
          name: atom.name,
          description: atom.description,
          difficulty: atom.difficulty,
          moleculeType: atom.moleculeType,
          subject: atom.subjectId ? atom.subjectId.name : null,
          status: 'not_started',
          grade: 'pending',
          timestamp: null,
          sourceTask: null,
        }));

      const locationParts = [];
      if (student?.location?.city) {
        locationParts.push(student.location.city);
      }
      if (student?.location?.country) {
        locationParts.push(student.location.country);
      }

      const response = {
        student: {
          id: student._id,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          profilePic: student.profilePic || null,
          location: locationParts.join(', '),
          educationProfile: student.educationProfiles?.student || null,
        },
        progress: {
          completed: completedAtoms,
          inProgress: inProgressAtoms,
          notStarted: notStartedAtoms.concat(unearnedAtoms),
        },
        summary: {
          totalCompleted: completedAtoms.length,
          totalInProgress: inProgressAtoms.length,
          totalNotStarted: notStartedAtoms.length + unearnedAtoms.length,
          totalAtoms: allAtoms.length,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  return {
    getProgress,
    getProgressByStudent,
    getProgressByAtom,
    getProgressById,
    getProgressByStudentAndAtom,
    createProgress,
    updateProgress,
    deleteProgress,
    updateProgressStatus,
    gradeProgress,
    getProgressByStatus,
    getStudentProgressSummary,
    getEducatorStudentProgress,
  };
};

module.exports = progressController;
