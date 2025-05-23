import PDFDocument from 'pdfkit';

/**
 * Generate a PDF invoice
 * @param {Object} invoice - The invoice data with populated references
 * @returns {Promise<Buffer>} - PDF document as a buffer
 */
export const generatePDF = (invoice) => {
  return new Promise((resolve, reject) => {
    try {
      // Create a PDF document
      const doc = new PDFDocument({ margin: 50 });
      
      // Buffer to store PDF
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      
      // Format date
      const formatDate = (date) => {
        const d = new Date(date);
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      };
      
      // Add clinic logo if available
      if (invoice.clinicId?.logo) {
        doc.image(invoice.clinicId.logo, 50, 45, { width: 150 });
      } else {
        // Add clinic name as text if no logo
        doc.fontSize(20).font('Helvetica-Bold').text(invoice.clinicId?.name || 'Clinic', 50, 45);
      }
      
      // Add invoice title and number
      doc.fontSize(16).font('Helvetica-Bold').text('INVOICE', 400, 50);
      doc.fontSize(10).font('Helvetica').text(`Invoice Number: ${invoice.invoiceNumber}`, 400, 70);
      doc.text(`Date: ${formatDate(invoice.createdAt)}`, 400, 85);
      
      // Add clinic info
      doc.fontSize(10).font('Helvetica').text('From:', 50, 120);
      doc.fontSize(10).font('Helvetica-Bold').text(invoice.clinicId?.name || 'Clinic', 50, 135);
      doc.fontSize(10).font('Helvetica').text(invoice.clinicId?.address || '', 50, 150);
      doc.text(invoice.clinicId?.phone || '', 50, 165);
      doc.text(invoice.clinicId?.email || '', 50, 180);
      
      // Add patient info
      doc.fontSize(10).font('Helvetica').text('Bill To:', 300, 120);
      doc.fontSize(10).font('Helvetica-Bold').text(invoice.patientId?.name || 'Patient', 300, 135);
      doc.fontSize(10).font('Helvetica').text(invoice.patientId?.address || '', 300, 150);
      doc.text(invoice.patientId?.phone || '', 300, 165);
      doc.text(invoice.patientId?.email || '', 300, 180);
      
      // Add payment info
      doc.fontSize(10).font('Helvetica').text('Payment Status:', 400, 210);
      doc.fontSize(10).font('Helvetica-Bold').text(invoice.paymentStatus, 490, 210);
      doc.fontSize(10).font('Helvetica').text('Payment Method:', 400, 225);
      doc.fontSize(10).font('Helvetica').text(invoice.paymentMethod, 490, 225);
      
      // Add appointment info if available
      if (invoice.appointmentId) {
        doc.fontSize(10).font('Helvetica').text('Appointment:', 50, 210);
        doc.fontSize(10).font('Helvetica').text(
          `${formatDate(invoice.appointmentId.startTime)} - ${invoice.appointmentId.serviceType}`,
          140, 210
        );
      }
      
      // Add doctor info if available
      if (invoice.doctorId) {
        doc.fontSize(10).font('Helvetica').text('Doctor:', 50, 225);
        doc.fontSize(10).font('Helvetica').text(invoice.doctorId.name, 140, 225);
      }
      
      // Add table headers
      doc.moveTo(50, 260).lineTo(550, 260).stroke();
      doc.fontSize(10).font('Helvetica-Bold').text('Description', 50, 270);
      doc.text('Quantity', 300, 270);
      doc.text('Unit Price', 370, 270);
      doc.text('Amount', 480, 270);
      doc.moveTo(50, 285).lineTo(550, 285).stroke();
      
      // Add services
      let y = 300;
      invoice.services.forEach((service, index) => {
        doc.fontSize(10).font('Helvetica').text(service.name, 50, y);
        doc.text(service.quantity.toString(), 300, y);
        doc.text(`$${service.cost.toFixed(2)}`, 370, y);
        doc.text(`$${(service.quantity * service.cost).toFixed(2)}`, 480, y);
        y += 20;
      });
      
      // Add subtotal, discount, tax, and total
      const subtotalY = y + 20;
      doc.moveTo(50, subtotalY - 10).lineTo(550, subtotalY - 10).stroke();
      doc.fontSize(10).font('Helvetica').text('Subtotal:', 400, subtotalY);
      doc.text(`$${invoice.subtotal.toFixed(2)}`, 480, subtotalY);
      
      if (invoice.discount > 0) {
        doc.text(`Discount (${invoice.discount}%):`, 400, subtotalY + 20);
        doc.text(`-$${(invoice.subtotal * (invoice.discount / 100)).toFixed(2)}`, 480, subtotalY + 20);
      }
      
      if (invoice.tax > 0) {
        const taxY = invoice.discount > 0 ? subtotalY + 40 : subtotalY + 20;
        doc.text(`Tax (${invoice.tax}%):`, 400, taxY);
        const discountedAmount = invoice.subtotal * (1 - invoice.discount / 100);
        doc.text(`$${(discountedAmount * (invoice.tax / 100)).toFixed(2)}`, 480, taxY);
      }
      
      // Total
      const totalY = subtotalY + (invoice.discount > 0 ? 40 : 20) + (invoice.tax > 0 ? 20 : 0) + 20;
      doc.moveTo(350, totalY - 10).lineTo(550, totalY - 10).stroke();
      doc.fontSize(12).font('Helvetica-Bold').text('Total:', 400, totalY);
      doc.text(`$${invoice.total.toFixed(2)}`, 480, totalY);
      
      // Add payment details
      if (invoice.paidAmount > 0) {
        doc.fontSize(10).font('Helvetica').text('Paid Amount:', 400, totalY + 30);
        doc.text(`$${invoice.paidAmount.toFixed(2)}`, 480, totalY + 30);
        
        if (invoice.paidAmount < invoice.total) {
          doc.text('Balance Due:', 400, totalY + 50);
          doc.fontSize(10).font('Helvetica-Bold').text(`$${(invoice.total - invoice.paidAmount).toFixed(2)}`, 480, totalY + 50);
        }
      }
      
      // Add notes if available
      if (invoice.notes) {
        const notesY = totalY + (invoice.paidAmount > 0 ? 80 : 40);
        doc.fontSize(10).font('Helvetica-Bold').text('Notes:', 50, notesY);
        doc.fontSize(10).font('Helvetica').text(invoice.notes, 50, notesY + 15, { width: 500 });
      }
      
      // Add footer
      const pageHeight = doc.page.height;
      doc.fontSize(10).font('Helvetica').text('Thank you for your business!', 50, pageHeight - 100, { align: 'center' });
      
      // Finalize the PDF
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
};
