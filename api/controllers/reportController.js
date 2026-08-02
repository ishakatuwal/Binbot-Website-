const PDFDocument = require('pdfkit');
const Task = require('../../backend/models/Task');

exports.generatePdfReport = async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=SmartBin_Collection_Tasks_Report_${Date.now()}.pdf`);

    doc.pipe(res);

    doc.fillColor('#0f172a').fontSize(20).text('Smart Waste Management System', { align: 'left' });
    doc.fillColor('#475569').fontSize(12).text('Collection Task Assignments & Dispatch Report', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#64748b').text(`Generated On: ${new Date().toLocaleString()}`, { align: 'left' });
    doc.moveDown(1);

    doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#cbd5e1').stroke();
    doc.moveDown(1);

    if (tasks.length === 0) {
      doc.fillColor('#64748b').fontSize(12).text('No task assignments recorded in system database.', { align: 'center' });
    } else {
      let startY = doc.y;
      doc.fontSize(10).fillColor('#0f172a');
      doc.text('Staff Name', 40, startY, { width: 100 });
      doc.text('Phone', 140, startY, { width: 90 });
      doc.text('Bin ID', 230, startY, { width: 60 });
      doc.text('Location Address', 290, startY, { width: 140 });
      doc.text('Compartment', 430, startY, { width: 70 });
      doc.text('Status', 500, startY, { width: 50 });

      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#e2e8f0').stroke();
      doc.moveDown(0.5);

      tasks.forEach((t) => {
        let rowY = doc.y;
        if (rowY > 750) { doc.addPage(); rowY = 40; }

        doc.fontSize(9).fillColor('#334155');
        doc.text(t.staffName || 'Staff', 40, rowY, { width: 100 });
        doc.text(t.staffPhone || '-', 140, rowY, { width: 90 });
        doc.text(t.binId || '-', 230, rowY, { width: 60 });
        doc.text(t.location || '-', 290, rowY, { width: 140 });
        doc.text((t.compartment || '').toUpperCase(), 430, rowY, { width: 70 });
        doc.text(t.status || 'ASSIGNED', 500, rowY, { width: 50 });

        doc.moveDown(0.8);
      });
    }

    doc.fontSize(8).fillColor('#94a3b8').text('Confidential - Enterprise Smart Waste Management System', 40, 780, { align: 'center' });
    doc.end();
  } catch (error) {
    res.status(500).send('Error generating PDF report document');
  }
};
