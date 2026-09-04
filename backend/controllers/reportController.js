/**
 * backend/controllers/reportController.js
 * PDFKit Report Generation Engine (Story 22).
 * Streams formatted PDF document containing table of assigned and completed collection tasks.
 */

const PDFDocument = require('pdfkit');
const Task = require('../models/Task');

exports.generatePdfReport = async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
    const inProgressTasks = tasks.filter(t => t.status === 'ASSIGNED').length;

    // Create PDFDocument instance
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    // Set Response Headers for direct PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=SmartBin_Collection_Tasks_Report_${Date.now()}.pdf`);

    // Pipe PDF to response stream
    doc.pipe(res);

    // Title Header
    doc.fillColor('#0f172a').fontSize(20).text('Binbot Smart Waste Management System', { align: 'left' });
    doc.fillColor('#475569').fontSize(12).text('Collection Task Assignments & Dispatch Report', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#64748b').text(`Generated On: ${new Date().toLocaleString()} (AEST Brisbane)`, { align: 'left' });
    doc.moveDown(0.5);

    // Summary Statistics Badges
    doc.fontSize(9).fillColor('#0369a1').text(`Total Logged Tasks: ${totalTasks}  |  Completed Tasks: ${completedTasks}  |  Pending / In-Progress: ${inProgressTasks}`, { align: 'left' });
    doc.moveDown(0.8);

    // Horizontal Line
    doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#cbd5e1').stroke();
    doc.moveDown(1);

    if (tasks.length === 0) {
      doc.fillColor('#64748b').fontSize(12).text('No task assignments recorded in system database.', { align: 'center' });
    } else {
      // Table Header Row
      let startY = doc.y;
      doc.fontSize(10).fillColor('#0f172a');
      doc.text('Staff Name', 40, startY, { width: 95, bold: true });
      doc.text('Phone', 135, startY, { width: 80 });
      doc.text('Bin ID', 215, startY, { width: 55 });
      doc.text('Location Address', 270, startY, { width: 130 });
      doc.text('Waste Type', 405, startY, { width: 65 });
      doc.text('Task Status', 475, startY, { width: 75, align: 'right' });

      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#94a3b8').stroke();
      doc.moveDown(0.6);

      // Table Data Rows
      tasks.forEach((t) => {
        let rowY = doc.y;

        // Check page overflow
        if (rowY > 730) {
          doc.addPage();
          rowY = 40;
        }

        const isCompleted = t.status === 'COMPLETED';

        doc.fontSize(9).fillColor('#334155');
        doc.text(t.staffName || 'Staff', 40, rowY, { width: 95 });
        doc.text(t.staffPhone || '-', 135, rowY, { width: 80 });
        doc.text(t.binId || '-', 215, rowY, { width: 55 });
        doc.text(t.location || 'Brisbane CBD', 270, rowY, { width: 130 });
        doc.text((t.compartment || 'DRY').toUpperCase(), 405, rowY, { width: 65 });

        // Highlight Status: Green for COMPLETED, Blue for ASSIGNED
        if (isCompleted) {
          doc.fillColor('#059669').fontSize(9).text('COMPLETED', 475, rowY, { width: 75, align: 'right', bold: true });
        } else {
          doc.fillColor('#0284c7').fontSize(9).text('ASSIGNED', 475, rowY, { width: 75, align: 'right', bold: true });
        }

        doc.moveDown(0.8);
      });
    }

    // Footer
    doc.fontSize(8).fillColor('#94a3b8').text('Confidential & Operational Audit Document - Binbot Smart Waste Management Platform', 40, 780, { align: 'center' });

    // End Document Stream
    doc.end();
  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).send('Error generating PDF report document');
  }
};
