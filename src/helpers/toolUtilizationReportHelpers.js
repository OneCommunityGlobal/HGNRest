const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
const { PDF_STYLES, PDF_MOVE_DOWN_HALF } = require('../constants/toolUtilization');

// ─── writePDFSection (internal helper) ───
const writePDFSection = (doc, title, items, formatLine) => {
  if (items.length === 0) return;
  doc.moveDown();
  doc.fontSize(PDF_STYLES.FONT_SIZE_SECTION_HEADER).font('Helvetica-Bold').text(title);
  doc.moveDown(PDF_MOVE_DOWN_HALF);
  items.forEach((item, idx) => {
    if (doc.y > PDF_STYLES.PAGE_BREAK_THRESHOLD) doc.addPage();
    doc.fontSize(PDF_STYLES.FONT_SIZE_DETAIL).font('Helvetica');
    doc.text(formatLine(item, idx));
  });
};

// ─── generatePDFReport ───
const generatePDFReport = (res, reportData) => {
  const { utilizationData, alerts, balancing, recommendations, summary, metadata } = reportData;
  const doc = new PDFDocument({
    margin: PDF_STYLES.PAGE_MARGIN,
    bufferPages: true,
    compress: true,
  });
  const filename = `tool-utilization-report-${Date.now()}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  doc.pipe(res);

  doc
    .fontSize(PDF_STYLES.FONT_SIZE_TITLE)
    .font('Helvetica-Bold')
    .text('Tool Utilization & Procurement/Operations Report', { align: 'center' });
  doc.moveDown();

  doc.fontSize(PDF_STYLES.FONT_SIZE_METADATA).font('Helvetica').fillColor('#666666');
  doc.text(`Generated: ${metadata.generatedDate}`);
  doc.text(`Date Range: ${metadata.dateRange}`);
  doc.text(`Project Filter: ${metadata.projectFilter}`);
  doc.moveDown();
  doc.fillColor('#000000');

  doc.fontSize(PDF_STYLES.FONT_SIZE_SECTION_HEADER).font('Helvetica-Bold').text('Summary');
  doc.fontSize(PDF_STYLES.FONT_SIZE_BODY).font('Helvetica');
  doc.text(`Total Tool Types: ${summary.totalToolTypes}`);
  doc.text(`Average Utilization: ${summary.averageUtilization}%`);
  doc.text(
    `Under-utilized: ${summary.underUtilized} | Normal: ${summary.normal} | Over-utilized: ${summary.overUtilized}`,
  );
  doc.moveDown();

  doc
    .fontSize(PDF_STYLES.FONT_SIZE_SECTION_HEADER)
    .font('Helvetica-Bold')
    .text('Utilization Details');
  doc.moveDown(PDF_MOVE_DOWN_HALF);
  utilizationData.forEach((item) => {
    if (doc.y > PDF_STYLES.PAGE_BREAK_THRESHOLD) doc.addPage();
    doc.fontSize(PDF_STYLES.FONT_SIZE_BODY).font('Helvetica-Bold');
    doc.text(`${item.name} — ${item.utilizationRate}% (${item.classification.label})`);
    doc.fontSize(PDF_STYLES.FONT_SIZE_DETAIL).font('Helvetica');
    doc.text(`  Downtime: ${item.downtime} hrs | Tool Count: ${item.toolCount}`);
    doc.moveDown(PDF_MOVE_DOWN_HALF);
  });

  writePDFSection(
    doc,
    'Maintenance Alerts',
    alerts,
    (alert) => `\u2022 [${alert.urgency.toUpperCase()}] ${alert.toolName}: ${alert.message}`,
  );

  writePDFSection(
    doc,
    'Resource Balancing Suggestions',
    balancing,
    (item, idx) => `${idx + 1}. ${item.suggestion} ${item.rationale}`,
  );

  writePDFSection(
    doc,
    'Recommendations',
    recommendations,
    (rec) => `\u2022 ${rec.toolName}: ${rec.action}`,
  );

  doc.end();
};

// ─── generateCSVReport ───
const generateCSVReport = (res, reportData) => {
  const { utilizationData, alerts, recommendations } = reportData;
  const filename = `tool-utilization-report-${Date.now()}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const alertsByTool = {};
  alerts.forEach((alert) => {
    if (!alertsByTool[alert.toolName]) alertsByTool[alert.toolName] = [];
    alertsByTool[alert.toolName].push(alert.message);
  });

  const recByTool = {};
  recommendations.forEach((rec) => {
    recByTool[rec.toolName] = rec.action;
  });

  const rows = utilizationData.map((item) => ({
    name: item.name,
    utilizationRate: item.utilizationRate,
    downtime: item.downtime,
    classificationLabel: item.classification.label,
    trafficLight: item.classification.trafficLight,
    toolCount: item.toolCount,
    maintenanceAlert: (alertsByTool[item.name] || []).join('; ') || 'None',
    recommendation: recByTool[item.name] || 'None',
  }));

  const fields = [
    { label: 'Tool Name', value: 'name' },
    { label: 'Utilization Rate (%)', value: 'utilizationRate' },
    { label: 'Downtime (hours)', value: 'downtime' },
    { label: 'Classification', value: 'classificationLabel' },
    { label: 'Traffic Light', value: 'trafficLight' },
    { label: 'Tool Count', value: 'toolCount' },
    { label: 'Maintenance Alert', value: 'maintenanceAlert' },
    { label: 'Recommendation', value: 'recommendation' },
  ];

  const parser = new Parser({ fields });
  const csv = parser.parse(rows);
  res.send(`\ufeff${csv}`);
};

module.exports = {
  generatePDFReport,
  generateCSVReport,
};
