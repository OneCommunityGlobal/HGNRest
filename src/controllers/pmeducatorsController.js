const mongoose = require("mongoose");
const Educator = require("../models/pmEducators");
const Student = require("../models/pmStudents");

const toInt = (v, def, min = 1, max = 1000) => {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return def;
  return Math.min(Math.max(n, min), max);
};

const shapeEducatorList = (e) => ({
  id: String(e._id),
  name: e.name,
  subject: e.subject,
  studentCount: e.studentCount ?? 0,
});

const getEducators = async (req, res) => {
  try {
    let data = await Educator.find().lean();

    // If DB is empty → return mock data
    if (!data.length) {
      return res.json({
        data: [
          { id: "t-001", name: "Alice Johnson", subject: "Mathematics", studentCount: 3 },
          { id: "t-002", name: "Brian Lee", subject: "Science", studentCount: 2 },
          { id: "t-003", name: "John Doe", subject: "English", studentCount: 1 }
        ],
        mock: true
      });
    }

    res.json({
      data: data.map(e => ({
        id: String(e._id),
        name: e.name,
        subject: e.subject,
        studentCount: e.studentCount ?? 0,
      }))
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch educators" });
  }
};

const getEducatorById = async (req, res) => {
  try {
    const { educatorId } = req.params;
    if (!mongoose.isValidObjectId(educatorId)) return res.status(400).json({ error: "Invalid educatorId" });
    const edu = await Educator.findById(educatorId);
    if (!edu) return res.status(404).json({ error: "Educator not found" });
    res.json({ data: shapeEducatorList({ ...edu.toObject(), studentCount: await Student.countDocuments({ educator: edu._id }) }) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch educator" });
  }
};

const getStudentsByEducator = async (req, res) => {
  try {
    const { educatorId } = req.params;

    const hasAny = await Student.countDocuments();
    if (!hasAny) {
      const mockData = {
        "t-001": [
          { id: "s-101", name: "Jay", grade: "7", progress: 0.78 },
          { id: "s-102", name: "Kate", grade: "7", progress: 0.62 },
          { id: "s-103", name: "Sam", grade: "8", progress: 0.85 }
        ],
        "t-002": [
          { id: "s-201", name: "Alina Gupta", grade: "6", progress: 0.54 },
          { id: "s-202", name: "Samir Khan", grade: "6", progress: 0.91 }
        ],
        "t-003": [
          { id: "s-301", name: "Ryan", grade: "7", progress: 0.73 }
        ]
      };
      return res.json({ data: mockData[educatorId] || [] });
    }

    const data = await Student.find({ educator: educatorId }).lean();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch students" });
  }
};


const getSubjects = async (_req, res) => {
  try {
    const subjects = await Educator.distinct("subject");
    res.json({ data: subjects.sort(), total: subjects.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
};

const searchStudentsAcrossEducators = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const page = toInt(req.query.page, 1, 1, 9999);
    const limit = toInt(req.query.limit, 10, 1, 100);

    const match = {};
    if (q) match.name = { $regex: q, $options: "i" };

    const total = await Student.countDocuments(match);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(Math.max(1, page), totalPages);

    const data = await Student.find(match)
      .populate({ path: "educator", select: "name subject" })
      .sort({ name: 1 })
      .skip((currentPage - 1) * limit)
      .limit(limit)
      .lean();

    const shaped = data.map((s) => ({
      id: String(s._id),
      name: s.name,
      grade: s.grade,
      progress: s.progress,
      educatorId: s.educator ? String(s.educator._id) : null,
      educatorName: s.educator ? s.educator.name : null,
      subject: s.educator ? s.educator.subject : null,
    }));

    res.json({ data: shaped, page: currentPage, totalPages, total, filters: { q } });
  } catch (err) {
    res.status(500).json({ error: "Failed to search students" });
  }
};

module.exports = {
  getEducators,
  getEducatorById,
  getStudentsByEducator,
  getSubjects,
  searchStudentsAcrossEducators,
};
