const mockEducators = [
  {
    id: "t-001",
    name: "Alice Johnson",
    subject: "Mathematics",
    students: [
      { id: "s-101", name: "Jay", grade: "7", progress: 0.78 },
      { id: "s-102", name: "Kate", grade: "7", progress: 0.62 },
      { id: "s-103", name: "Sam", grade: "8", progress: 0.85 },
    ],
  },
  {
    id: "t-002",
    name: "Brian Lee",
    subject: "Science",
    students: [
      { id: "s-201", name: "Alina Gupta", grade: "6", progress: 0.54 },
      { id: "s-202", name: "Samir Khan", grade: "6", progress: 0.91 },
    ],
  },
  {
    id: "t-003",
    name: "John Doe",
    subject: "English",
    students: [{ id: "s-301", name: "Ryan", grade: "7", progress: 0.73 }],
  },
];

function toInt(v, def, min = 1, max = 1000) {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return def;
  return Math.min(Math.max(n, min), max);
}
function sortByKey(arr, key, dir = "asc") {
  const mul = dir === "desc" ? -1 : 1;
  return arr.sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === "string" && typeof bv === "string") {
      return av.localeCompare(bv) * mul;
    }
    if (av > bv) return 1 * mul;
    if (av < bv) return -1 * mul;
    return 0;
  });
}
function paginate(arr, page, limit) {
  const total = arr.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * limit;
  const data = arr.slice(start, start + limit);
  return { data, page: currentPage, totalPages, total };
}
function shapeEducatorList(e) {
  return {
    id: e.id,
    name: e.name,
    subject: e.subject,
    studentCount: e.students.length,
  };
}

exports.getEducators = (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const subject = String(req.query.subject || "").trim();
    const page = toInt(req.query.page, 1, 1, 9999);
    const limit = toInt(req.query.limit, 10, 1, 100);
    const sortBy = ["name", "subject", "studentCount"].includes(req.query.sortBy)
      ? req.query.sortBy
      : "name";
    const sortDir = req.query.sortDir === "desc" ? "desc" : "asc";

    let list = mockEducators.filter((e) => {
      const matchesQ =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q);
      const matchesSubject = !subject || e.subject === subject;
      return matchesQ && matchesSubject;
    });
    list = list.map(shapeEducatorList);
    list = sortByKey(list, sortBy, sortDir);
    const result = paginate(list, page, limit);
    const subjects = Array.from(new Set(mockEducators.map((e) => e.subject))).sort();

    res.json({
      ...result,
      sortBy,
      sortDir,
      filters: { q, subject },
      subjects,
    });
  } catch (err) {
    console.error("getEducators error:", err);
    res.status(500).json({ error: "Failed to fetch educators" });
  }
};

exports.getStudentsByEducator = (req, res) => {
  try {
    const { educatorId } = req.params;
    const q = String(req.query.q || "").trim().toLowerCase();
    const page = toInt(req.query.page, 1, 1, 9999);
    const limit = toInt(req.query.limit, 10, 1, 100);
    const sortBy = ["name", "grade", "progress"].includes(req.query.sortBy)
      ? req.query.sortBy
      : "name";
    const sortDir = req.query.sortDir === "desc" ? "desc" : "asc";

    const educator = mockEducators.find((e) => e.id === educatorId);
    if (!educator) return res.status(404).json({ error: "Educator not found" });
    let students = educator.students.filter((s) => !q || s.name.toLowerCase().includes(q));
    if (sortBy === "grade") {
      students = students.map((s) => ({ ...s, _gradeNum: Number(s.grade) || 0 }));
      students = sortByKey(students, "_gradeNum", sortDir).map((s) => {
        delete s._gradeNum;
        return s;
      });
    } else {
      students = sortByKey(students, sortBy, sortDir);
    }
    const result = paginate(students, page, limit);

    res.json({
      ...result,
      educator: { id: educator.id, name: educator.name, subject: educator.subject },
      sortBy,
      sortDir,
      filters: { q },
    });
  } catch (err) {
    console.error("getStudentsByEducator error:", err);
    res.status(500).json({ error: "Failed to fetch students" });
  }
};
