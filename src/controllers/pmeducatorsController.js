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
    const q = String(req.query.q || "").trim();
    const subject = String(req.query.subject || "").trim();
    const page = toInt(req.query.page, 1, 1, 9999);
    const limit = toInt(req.query.limit, 10, 1, 100);
    const sortBy = ["name", "subject", "studentCount"].includes(req.query.sortBy)
      ? req.query.sortBy
      : "name";
    const sortDir = req.query.sortDir === "desc" ? -1 : 1;

    const match = {};
    if (q) match.$or = [{ name: { $regex: q, $options: "i" } }, { subject: { $regex: q, $options: "i" } }];
    if (subject) match.subject = subject;

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: "students",
          localField: "_id",
          foreignField: "educator",
          as: "students",
        },
      },
      { $addFields: { studentCount: { $size: "$students" } } },
      { $project: { students: 0 } },
    ];

    const sortStage =
      sortBy === "studentCount"
        ? { $sort: { studentCount: sortDir, name: 1 } }
        : { $sort: { [sortBy]: sortDir } };

    const countAgg = await Educator.aggregate([...pipeline, { $count: "total" }]);
    const total = countAgg[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(Math.max(1, page), totalPages);

    const dataAgg = await Educator.aggregate([
      ...pipeline,
      sortStage,
      { $skip: (currentPage - 1) * limit },
      { $limit: limit },
    ]);

    const subjects = await Educator.distinct("subject");

    res.json({
      data: dataAgg.map(shapeEducatorList),
      page: currentPage,
      totalPages,
      total,
      sortBy,
      sortDir: sortDir === 1 ? "asc" : "desc",
      filters: { q, subject },
      subjects: subjects.sort(),
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
    if (!mongoose.isValidObjectId(educatorId)) return res.status(400).json({ error: "Invalid educatorId" });
    const edu = await Educator.findById(educatorId);
    if (!edu) return res.status(404).json({ error: "Educator not found" });

    const q = String(req.query.q || "").trim();
    const page = toInt(req.query.page, 1, 1, 9999);
    const limit = toInt(req.query.limit, 10, 1, 100);
    const sortBy = ["name", "grade", "progress"].includes(req.query.sortBy) ? req.query.sortBy : "name";
    const sortDir = req.query.sortDir === "desc" ? -1 : 1;

    const match = { educator: edu._id };
    if (q) match.name = { $regex: q, $options: "i" };

    let sort = {};
    if (sortBy === "grade") sort = { grade: sortDir, name: 1 };
    else sort = { [sortBy]: sortDir, name: 1 };

    const total = await Student.countDocuments(match);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(Math.max(1, page), totalPages);

    const data = await Student.find(match)
      .sort(sort)
      .skip((currentPage - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      data,
      page: currentPage,
      totalPages,
      total,
      educator: { id: String(edu._id), name: edu.name, subject: edu.subject },
      sortBy,
      sortDir: sortDir === 1 ? "asc" : "desc",
      filters: { q },
    });
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
