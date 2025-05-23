import Appointment from '../models/Appointment.js';
import Invoice from '../models/Invoice.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import Staff from '../models/Staff.js';
import InventoryItem from '../models/InventoryItem.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import mongoose from 'mongoose';
// Using dynamic imports for PDFKit and ExcelJS to avoid issues
let PDFDocument;
let ExcelJS;

// These will be dynamically imported when needed
const loadPdfLibrary = async () => {
  if (!PDFDocument) {
    try {
      const module = await import('pdfkit');
      PDFDocument = module.default;
    } catch (error) {
      console.error('Error loading PDFKit:', error);
      throw new Error('PDF generation library not available');
    }
  }
  return PDFDocument;
};

const loadExcelLibrary = async () => {
  if (!ExcelJS) {
    try {
      const module = await import('exceljs');
      ExcelJS = module.default;
    } catch (error) {
      console.error('Error loading ExcelJS:', error);
      throw new Error('Excel generation library not available');
    }
  }
  return ExcelJS;
};
import fs from 'fs';
import path from 'path';

// Helper function to get date range
const getDateRange = (range) => {
  const now = new Date();
  const endDate = new Date(now);
  let startDate;

  switch (range) {
    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 3);
      break;
    case 'year':
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1); // Default to last month
  }

  return { startDate, endDate };
};

// Generate financial report
const getFinancialReport = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { dateRange = 'month' } = req.query;
    const { startDate, endDate } = getDateRange(dateRange);

    // Ensure user has access to this clinic
    if (req.user.clinicId.toString() !== clinicId && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized to access this clinic data' });
    }

    // Get invoices for the date range
    const invoices = await Invoice.find({
      clinicId: mongoose.Types.ObjectId(clinicId),
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('patientId', 'name');

    // Calculate totals
    const totalRevenue = invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
    const paidAmount = invoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0);
    const outstandingPayments = totalRevenue - paidAmount;
    const averageTransaction = invoices.length > 0 ? totalRevenue / invoices.length : 0;

    // Group by service type
    const serviceMap = {};
    invoices.forEach(invoice => {
      invoice.items.forEach(item => {
        if (!serviceMap[item.description]) {
          serviceMap[item.description] = 0;
        }
        serviceMap[item.description] += item.amount;
      });
    });

    const revenueByService = Object.keys(serviceMap).map(service => ({
      service,
      amount: serviceMap[service]
    })).sort((a, b) => b.amount - a.amount);

    // Monthly trend
    const monthlyData = await Invoice.aggregate([
      {
        $match: {
          clinicId: mongoose.Types.ObjectId(clinicId),
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    const monthlyTrend = monthlyData.map(item => ({
      month: item._id,
      revenue: item.revenue,
      count: item.count
    }));

    res.json({
      totalRevenue,
      paidAmount,
      outstandingPayments,
      averageTransaction,
      revenueByService,
      monthlyTrend,
      invoiceCount: invoices.length,
      dateRange: {
        start: startDate,
        end: endDate
      }
    });
  } catch (error) {
    console.error('Error generating financial report:', error);
    res.status(500).json({ message: 'Failed to generate financial report', error: error.message });
  }
};

// Generate appointment report
const getAppointmentReport = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { dateRange = 'month' } = req.query;
    const { startDate, endDate } = getDateRange(dateRange);

    // Ensure user has access to this clinic
    if (req.user.clinicId.toString() !== clinicId && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized to access this clinic data' });
    }

    // Get appointments for the date range
    const appointments = await Appointment.find({
      clinicId: mongoose.Types.ObjectId(clinicId),
      appointmentDate: { $gte: startDate, $lte: endDate }
    }).populate('doctorId', 'name').populate('patientId', 'name');

    // Calculate statistics
    const totalAppointments = appointments.length;
    const completedAppointments = appointments.filter(app => app.status === 'completed').length;
    const cancelledAppointments = appointments.filter(app => app.status === 'cancelled').length;
    const noShowAppointments = appointments.filter(app => app.status === 'no-show').length;

    const completionRate = totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0;
    const cancellationRate = totalAppointments > 0 ? (cancelledAppointments / totalAppointments) * 100 : 0;
    const noShowRate = totalAppointments > 0 ? (noShowAppointments / totalAppointments) * 100 : 0;

    // Group by doctor
    const doctorMap = {};
    appointments.forEach(appointment => {
      const doctorId = appointment.doctorId?._id?.toString() || 'unknown';
      const doctorName = appointment.doctorId?.name || 'Unknown Doctor';
      
      if (!doctorMap[doctorId]) {
        doctorMap[doctorId] = {
          doctorId,
          doctorName,
          total: 0,
          completed: 0,
          cancelled: 0,
          noShow: 0
        };
      }
      
      doctorMap[doctorId].total++;
      if (appointment.status === 'completed') doctorMap[doctorId].completed++;
      if (appointment.status === 'cancelled') doctorMap[doctorId].cancelled++;
      if (appointment.status === 'no-show') doctorMap[doctorId].noShow++;
    });

    const appointmentsByDoctor = Object.values(doctorMap);

    // Group by day of week
    const dayMap = {0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday'};
    const appointmentsByDay = [0, 1, 2, 3, 4, 5, 6].map(day => {
      const count = appointments.filter(app => new Date(app.appointmentDate).getDay() === day).length;
      return { day: dayMap[day], count };
    });

    res.json({
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      noShowAppointments,
      completionRate,
      cancellationRate,
      noShowRate,
      appointmentsByDoctor,
      appointmentsByDay,
      dateRange: {
        start: startDate,
        end: endDate
      }
    });
  } catch (error) {
    console.error('Error generating appointment report:', error);
    res.status(500).json({ message: 'Failed to generate appointment report', error: error.message });
  }
};

// Generate patient report
const getPatientReport = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { dateRange = 'month' } = req.query;
    const { startDate, endDate } = getDateRange(dateRange);

    // Ensure user has access to this clinic
    if (req.user.clinicId.toString() !== clinicId && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized to access this clinic data' });
    }

    // Get patients registered in the date range
    const patients = await Patient.find({
      clinicId: mongoose.Types.ObjectId(clinicId),
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Get all patients for the clinic
    const allPatients = await Patient.find({
      clinicId: mongoose.Types.ObjectId(clinicId)
    });

    // Calculate new vs returning patients
    const newPatients = patients.length;
    const totalPatients = allPatients.length;

    // Demographics
    const ageGroups = {
      'Under 18': 0,
      '18-30': 0,
      '31-45': 0,
      '46-60': 0,
      'Over 60': 0
    };

    const genderDistribution = {
      'Male': 0,
      'Female': 0,
      'Other': 0
    };

    allPatients.forEach(patient => {
      // Age calculation
      if (patient.dateOfBirth) {
        const age = new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear();
        if (age < 18) ageGroups['Under 18']++;
        else if (age <= 30) ageGroups['18-30']++;
        else if (age <= 45) ageGroups['31-45']++;
        else if (age <= 60) ageGroups['46-60']++;
        else ageGroups['Over 60']++;
      }

      // Gender
      if (patient.gender) {
        if (patient.gender.toLowerCase() === 'male') genderDistribution['Male']++;
        else if (patient.gender.toLowerCase() === 'female') genderDistribution['Female']++;
        else genderDistribution['Other']++;
      }
    });

    // Monthly trend
    const monthlyData = await Patient.aggregate([
      {
        $match: {
          clinicId: mongoose.Types.ObjectId(clinicId),
          createdAt: { $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)) }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    const patientGrowth = monthlyData.map(item => ({
      month: item._id,
      newPatients: item.count
    }));

    res.json({
      totalPatients,
      newPatients,
      ageGroups: Object.keys(ageGroups).map(group => ({ group, count: ageGroups[group] })),
      genderDistribution: Object.keys(genderDistribution).map(gender => ({ gender, count: genderDistribution[gender] })),
      patientGrowth,
      dateRange: {
        start: startDate,
        end: endDate
      }
    });
  } catch (error) {
    console.error('Error generating patient report:', error);
    res.status(500).json({ message: 'Failed to generate patient report', error: error.message });
  }
};

// Generate inventory report
const getInventoryReport = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { dateRange = 'month' } = req.query;
    const { startDate, endDate } = getDateRange(dateRange);

    // Ensure user has access to this clinic
    if (req.user.clinicId.toString() !== clinicId && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized to access this clinic data' });
    }

    // Get inventory items
    const inventoryItems = await InventoryItem.find({
      clinicId: mongoose.Types.ObjectId(clinicId)
    });

    // Get inventory transactions
    const transactions = await InventoryTransaction.find({
      clinicId: mongoose.Types.ObjectId(clinicId),
      transactionDate: { $gte: startDate, $lte: endDate }
    }).populate('itemId');

    // Calculate inventory statistics
    const totalItems = inventoryItems.length;
    const lowStockItems = inventoryItems.filter(item => item.currentStock <= item.reorderLevel).length;
    const outOfStockItems = inventoryItems.filter(item => item.currentStock === 0).length;
    
    const totalValue = inventoryItems.reduce((sum, item) => sum + (item.currentStock * item.unitPrice), 0);

    // Group by category
    const categoryMap = {};
    inventoryItems.forEach(item => {
      if (!categoryMap[item.category]) {
        categoryMap[item.category] = {
          category: item.category,
          count: 0,
          value: 0
        };
      }
      categoryMap[item.category].count++;
      categoryMap[item.category].value += item.currentStock * item.unitPrice;
    });

    const inventoryByCategory = Object.values(categoryMap);

    // Transaction analysis
    const incomingTransactions = transactions.filter(t => t.transactionType === 'purchase' || t.transactionType === 'return');
    const outgoingTransactions = transactions.filter(t => t.transactionType === 'usage' || t.transactionType === 'expired');

    const totalIncoming = incomingTransactions.reduce((sum, t) => sum + t.quantity, 0);
    const totalOutgoing = outgoingTransactions.reduce((sum, t) => sum + t.quantity, 0);

    // Top moving items
    const itemUsageMap = {};
    outgoingTransactions.forEach(t => {
      const itemId = t.itemId?._id?.toString() || 'unknown';
      const itemName = t.itemId?.name || 'Unknown Item';
      
      if (!itemUsageMap[itemId]) {
        itemUsageMap[itemId] = {
          itemId,
          itemName,
          quantity: 0
        };
      }
      
      itemUsageMap[itemId].quantity += t.quantity;
    });

    const topMovingItems = Object.values(itemUsageMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    res.json({
      totalItems,
      lowStockItems,
      outOfStockItems,
      totalValue,
      inventoryByCategory,
      totalIncoming,
      totalOutgoing,
      topMovingItems,
      dateRange: {
        start: startDate,
        end: endDate
      }
    });
  } catch (error) {
    console.error('Error generating inventory report:', error);
    res.status(500).json({ message: 'Failed to generate inventory report', error: error.message });
  }
};

// Get consolidated report
const getReport = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { type = 'financial', dateRange = 'month' } = req.query;

    // Ensure user has access to this clinic
    if (req.user.clinicId.toString() !== clinicId && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized to access this clinic data' });
    }

    switch (type) {
      case 'financial':
        return await getFinancialReport(req, res);
      case 'appointments':
        return await getAppointmentReport(req, res);
      case 'patients':
        return await getPatientReport(req, res);
      case 'inventory':
        return await getInventoryReport(req, res);
      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ message: 'Failed to generate report', error: error.message });
  }
};

// Export report as PDF or Excel
const exportReport = async (req, res) => {
  try {
    const { clinicId } = req.params;
    const { type = 'financial', dateRange = 'month', format = 'pdf' } = req.body;

    // Ensure user has access to this clinic
    if (req.user.clinicId.toString() !== clinicId && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized to access this clinic data' });
    }

    // Get report data
    let reportData;
    try {
      switch (type) {
        case 'financial':
          reportData = await getFinancialReportData(clinicId, dateRange);
          break;
        case 'appointments':
          reportData = await getAppointmentReportData(clinicId, dateRange);
          break;
        case 'patients':
          reportData = await getPatientReportData(clinicId, dateRange);
          break;
        case 'inventory':
          reportData = await getInventoryReportData(clinicId, dateRange);
          break;
        default:
          return res.status(400).json({ message: 'Invalid report type' });
      }
    } catch (error) {
      console.error(`Error retrieving ${type} report data:`, error);
      return res.status(500).json({ 
        message: `Failed to retrieve ${type} report data`, 
        error: error.message 
      });
    }

    // Generate report file
    try {
      if (format === 'pdf') {
        const pdfBuffer = await generatePdfReport(type, reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${type}-report.pdf`);
        return res.send(pdfBuffer);
      } else if (format === 'excel') {
        const excelBuffer = await generateExcelReport(type, reportData);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${type}-report.xlsx`);
        return res.send(excelBuffer);
      } else {
        return res.status(400).json({ message: 'Invalid export format' });
      }
    } catch (error) {
      console.error(`Error generating ${format} report:`, error);
      return res.status(500).json({ 
        message: `Failed to generate ${format} report`, 
        error: error.message 
      });
    }
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({ message: 'Failed to export report', error: error.message });
  }
};

// Helper functions for report generation
async function getFinancialReportData(clinicId, dateRange) {
  try {
    const { startDate, endDate } = getDateRange(dateRange);
    
    // Get invoices for the date range
    const invoices = await Invoice.find({
      clinicId: mongoose.Types.ObjectId(clinicId),
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('patientId', 'name');

    // Calculate totals
    const totalRevenue = invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
    const paidAmount = invoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0);
    const outstandingPayments = totalRevenue - paidAmount;
    const averageTransaction = invoices.length > 0 ? totalRevenue / invoices.length : 0;

    // Group by service type
    const serviceMap = {};
    invoices.forEach(invoice => {
      if (invoice.items && Array.isArray(invoice.items)) {
        invoice.items.forEach(item => {
          if (!serviceMap[item.description]) {
            serviceMap[item.description] = 0;
          }
          serviceMap[item.description] += item.amount;
        });
      }
    });

    const revenueByService = Object.keys(serviceMap).map(service => ({
      service,
      amount: serviceMap[service]
    })).sort((a, b) => b.amount - a.amount);
    
    return {
      totalRevenue,
      paidAmount,
      outstandingPayments,
      averageTransaction,
      revenueByService,
      invoiceCount: invoices.length,
      dateRange: {
        start: startDate,
        end: endDate
      }
    };
  } catch (error) {
    console.error('Error getting financial report data:', error);
    return {
      totalRevenue: 0,
      paidAmount: 0,
      outstandingPayments: 0,
      averageTransaction: 0,
      revenueByService: [],
      invoiceCount: 0,
      dateRange: { start: new Date(), end: new Date() }
    };
  }
}

async function getAppointmentReportData(clinicId, dateRange) {
  try {
    const { startDate, endDate } = getDateRange(dateRange);
    
    // Get appointments for the date range
    const appointments = await Appointment.find({
      clinicId: mongoose.Types.ObjectId(clinicId),
      appointmentDate: { $gte: startDate, $lte: endDate }
    }).populate('doctorId', 'name').populate('patientId', 'name');

    // Calculate statistics
    const totalAppointments = appointments.length;
    const completedAppointments = appointments.filter(app => app.status === 'completed').length;
    const cancelledAppointments = appointments.filter(app => app.status === 'cancelled').length;
    const noShowAppointments = appointments.filter(app => app.status === 'no-show').length;

    const completionRate = totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0;
    const cancellationRate = totalAppointments > 0 ? (cancelledAppointments / totalAppointments) * 100 : 0;
    const noShowRate = totalAppointments > 0 ? (noShowAppointments / totalAppointments) * 100 : 0;

    // Group by doctor
    const doctorMap = {};
    appointments.forEach(appointment => {
      const doctorId = appointment.doctorId?._id?.toString() || 'unknown';
      const doctorName = appointment.doctorId?.name || 'Unknown Doctor';
      
      if (!doctorMap[doctorId]) {
        doctorMap[doctorId] = {
          doctorId,
          doctorName,
          total: 0,
          completed: 0,
          cancelled: 0,
          noShow: 0
        };
      }
      
      doctorMap[doctorId].total++;
      if (appointment.status === 'completed') doctorMap[doctorId].completed++;
      if (appointment.status === 'cancelled') doctorMap[doctorId].cancelled++;
      if (appointment.status === 'no-show') doctorMap[doctorId].noShow++;
    });

    const appointmentsByDoctor = Object.values(doctorMap);
    
    return {
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      noShowAppointments,
      completionRate,
      cancellationRate,
      noShowRate,
      appointmentsByDoctor,
      dateRange: {
        start: startDate,
        end: endDate
      }
    };
  } catch (error) {
    console.error('Error getting appointment report data:', error);
    return {
      totalAppointments: 0,
      completedAppointments: 0,
      cancelledAppointments: 0,
      noShowAppointments: 0,
      completionRate: 0,
      cancellationRate: 0,
      noShowRate: 0,
      appointmentsByDoctor: [],
      dateRange: { start: new Date(), end: new Date() }
    };
  }
}

async function getPatientReportData(clinicId, dateRange) {
  try {
    const { startDate, endDate } = getDateRange(dateRange);
    
    // Get patients registered in the date range
    const patients = await Patient.find({
      clinicId: mongoose.Types.ObjectId(clinicId),
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Get all patients for the clinic
    const allPatients = await Patient.find({
      clinicId: mongoose.Types.ObjectId(clinicId)
    });

    // Calculate new vs returning patients
    const newPatients = patients.length;
    const totalPatients = allPatients.length;

    // Demographics
    const ageGroups = {
      'Under 18': 0,
      '18-30': 0,
      '31-45': 0,
      '46-60': 0,
      'Over 60': 0
    };

    const genderDistribution = {
      'Male': 0,
      'Female': 0,
      'Other': 0
    };

    allPatients.forEach(patient => {
      // Age calculation
      if (patient.dateOfBirth) {
        const age = new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear();
        if (age < 18) ageGroups['Under 18']++;
        else if (age <= 30) ageGroups['18-30']++;
        else if (age <= 45) ageGroups['31-45']++;
        else if (age <= 60) ageGroups['46-60']++;
        else ageGroups['Over 60']++;
      }

      // Gender
      if (patient.gender) {
        if (patient.gender.toLowerCase() === 'male') genderDistribution['Male']++;
        else if (patient.gender.toLowerCase() === 'female') genderDistribution['Female']++;
        else genderDistribution['Other']++;
      }
    });
    
    return {
      totalPatients,
      newPatients,
      ageGroups: Object.keys(ageGroups).map(group => ({ group, count: ageGroups[group] })),
      genderDistribution: Object.keys(genderDistribution).map(gender => ({ gender, count: genderDistribution[gender] })),
      dateRange: {
        start: startDate,
        end: endDate
      }
    };
  } catch (error) {
    console.error('Error getting patient report data:', error);
    return {
      totalPatients: 0,
      newPatients: 0,
      ageGroups: [],
      genderDistribution: [],
      dateRange: { start: new Date(), end: new Date() }
    };
  }
}

async function getInventoryReportData(clinicId, dateRange) {
  try {
    const { startDate, endDate } = getDateRange(dateRange);
    
    // Get inventory items
    const inventoryItems = await InventoryItem.find({
      clinicId: mongoose.Types.ObjectId(clinicId)
    });

    // Get inventory transactions
    const transactions = await InventoryTransaction.find({
      clinicId: mongoose.Types.ObjectId(clinicId),
      transactionDate: { $gte: startDate, $lte: endDate }
    }).populate('itemId');

    // Calculate inventory statistics
    const totalItems = inventoryItems.length;
    const lowStockItems = inventoryItems.filter(item => item.currentStock <= item.reorderLevel).length;
    const outOfStockItems = inventoryItems.filter(item => item.currentStock === 0).length;
    
    const totalValue = inventoryItems.reduce((sum, item) => sum + (item.currentStock * item.unitPrice), 0);

    // Group by category
    const categoryMap = {};
    inventoryItems.forEach(item => {
      if (!categoryMap[item.category]) {
        categoryMap[item.category] = {
          category: item.category,
          count: 0,
          value: 0
        };
      }
      categoryMap[item.category].count++;
      categoryMap[item.category].value += item.currentStock * item.unitPrice;
    });

    const inventoryByCategory = Object.values(categoryMap);
    
    return {
      totalItems,
      lowStockItems,
      outOfStockItems,
      totalValue,
      inventoryByCategory,
      dateRange: {
        start: startDate,
        end: endDate
      }
    };
  } catch (error) {
    console.error('Error getting inventory report data:', error);
    return {
      totalItems: 0,
      lowStockItems: 0,
      outOfStockItems: 0,
      totalValue: 0,
      inventoryByCategory: [],
      dateRange: { start: new Date(), end: new Date() }
    };
  }
}

async function generatePdfReport(type, data) {
  try {
    // Dynamically load PDFKit
    const PDFDocument = await loadPdfLibrary();
    
    // Create a PDF document
    const doc = new PDFDocument();
    const buffers = [];
    
    doc.on('data', buffers.push.bind(buffers));
    
    // Add content based on report type
    doc.fontSize(25).text(`${type.charAt(0).toUpperCase() + type.slice(1)} Report`, {
      align: 'center'
    });
    
    doc.moveDown();
    doc.fontSize(12);
    
    // Add basic report info
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, {
      align: 'left'
    });
    
    doc.moveDown();
    
    // Add report-specific content based on type
    switch (type) {
      case 'financial':
        doc.text('Financial Summary:', { underline: true });
        doc.moveDown(0.5);
        if (data.totalRevenue !== undefined) {
          doc.text(`Total Revenue: ₹${data.totalRevenue.toFixed(2)}`);
        }
        if (data.outstandingPayments !== undefined) {
          doc.text(`Outstanding Payments: ₹${data.outstandingPayments.toFixed(2)}`);
        }
        break;
        
      case 'appointments':
        doc.text('Appointment Summary:', { underline: true });
        doc.moveDown(0.5);
        if (data.totalAppointments !== undefined) {
          doc.text(`Total Appointments: ${data.totalAppointments}`);
        }
        if (data.completionRate !== undefined) {
          doc.text(`Completion Rate: ${data.completionRate.toFixed(1)}%`);
        }
        break;
        
      case 'patients':
        doc.text('Patient Summary:', { underline: true });
        doc.moveDown(0.5);
        if (data.totalPatients !== undefined) {
          doc.text(`Total Patients: ${data.totalPatients}`);
        }
        if (data.newPatients !== undefined) {
          doc.text(`New Patients: ${data.newPatients}`);
        }
        break;
        
      case 'inventory':
        doc.text('Inventory Summary:', { underline: true });
        doc.moveDown(0.5);
        if (data.totalItems !== undefined) {
          doc.text(`Total Items: ${data.totalItems}`);
        }
        if (data.lowStockItems !== undefined) {
          doc.text(`Low Stock Items: ${data.lowStockItems}`);
        }
        break;
        
      default:
        doc.text('No specific data available for this report type.');
    }
    
    doc.end();
    
    return new Promise((resolve) => {
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
    });
  } catch (error) {
    console.error('Error generating PDF report:', error);
    throw new Error(`PDF generation failed: ${error.message}`);
  }
}

async function generateExcelReport(type, data) {
  try {
    // Dynamically load ExcelJS
    const ExcelJS = await loadExcelLibrary();
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${type.charAt(0).toUpperCase() + type.slice(1)} Report`);
    
    // Add report generation date
    worksheet.addRow(['Report Generated:', new Date().toLocaleString()]);
    worksheet.addRow([]);
    
    // Add headers and data based on report type
    switch (type) {
      case 'financial':
        // Add headers
        worksheet.addRow(['Financial Report Summary']);
        worksheet.addRow([]);
        worksheet.addRow(['Metric', 'Value']);
        
        // Add data
        if (data.totalRevenue !== undefined) {
          worksheet.addRow(['Total Revenue', `₹${data.totalRevenue.toFixed(2)}`]);
        }
        if (data.paidAmount !== undefined) {
          worksheet.addRow(['Paid Amount', `₹${data.paidAmount.toFixed(2)}`]);
        }
        if (data.outstandingPayments !== undefined) {
          worksheet.addRow(['Outstanding Payments', `₹${data.outstandingPayments.toFixed(2)}`]);
        }
        if (data.averageTransaction !== undefined) {
          worksheet.addRow(['Average Transaction', `₹${data.averageTransaction.toFixed(2)}`]);
        }
        
        // Add revenue by service if available
        if (data.revenueByService && data.revenueByService.length > 0) {
          worksheet.addRow([]);
          worksheet.addRow(['Revenue By Service']);
          worksheet.addRow(['Service', 'Amount']);
          
          data.revenueByService.forEach(item => {
            worksheet.addRow([item.service, `₹${item.amount.toFixed(2)}`]);
          });
        }
        break;
        
      case 'appointments':
        // Add headers
        worksheet.addRow(['Appointment Report Summary']);
        worksheet.addRow([]);
        worksheet.addRow(['Metric', 'Value']);
        
        // Add data
        if (data.totalAppointments !== undefined) {
          worksheet.addRow(['Total Appointments', data.totalAppointments]);
        }
        if (data.completedAppointments !== undefined) {
          worksheet.addRow(['Completed Appointments', data.completedAppointments]);
        }
        if (data.cancelledAppointments !== undefined) {
          worksheet.addRow(['Cancelled Appointments', data.cancelledAppointments]);
        }
        if (data.noShowAppointments !== undefined) {
          worksheet.addRow(['No-Show Appointments', data.noShowAppointments]);
        }
        if (data.completionRate !== undefined) {
          worksheet.addRow(['Completion Rate', `${data.completionRate.toFixed(1)}%`]);
        }
        
        // Add appointments by doctor if available
        if (data.appointmentsByDoctor && data.appointmentsByDoctor.length > 0) {
          worksheet.addRow([]);
          worksheet.addRow(['Appointments By Doctor']);
          worksheet.addRow(['Doctor', 'Total', 'Completed', 'Completion Rate']);
          
          data.appointmentsByDoctor.forEach(item => {
            const completionRate = item.total > 0 ? (item.completed / item.total) * 100 : 0;
            worksheet.addRow([item.doctorName, item.total, item.completed, `${completionRate.toFixed(1)}%`]);
          });
        }
        break;
        
      case 'patients':
        // Add headers
        worksheet.addRow(['Patient Report Summary']);
        worksheet.addRow([]);
        worksheet.addRow(['Metric', 'Value']);
        
        // Add data
        if (data.totalPatients !== undefined) {
          worksheet.addRow(['Total Patients', data.totalPatients]);
        }
        if (data.newPatients !== undefined) {
          worksheet.addRow(['New Patients', data.newPatients]);
        }
        
        // Add age groups if available
        if (data.ageGroups && data.ageGroups.length > 0) {
          worksheet.addRow([]);
          worksheet.addRow(['Age Distribution']);
          worksheet.addRow(['Age Group', 'Count']);
          
          data.ageGroups.forEach(item => {
            worksheet.addRow([item.group, item.count]);
          });
        }
        
        // Add gender distribution if available
        if (data.genderDistribution && data.genderDistribution.length > 0) {
          worksheet.addRow([]);
          worksheet.addRow(['Gender Distribution']);
          worksheet.addRow(['Gender', 'Count']);
          
          data.genderDistribution.forEach(item => {
            worksheet.addRow([item.gender, item.count]);
          });
        }
        break;
        
      case 'inventory':
        // Add headers
        worksheet.addRow(['Inventory Report Summary']);
        worksheet.addRow([]);
        worksheet.addRow(['Metric', 'Value']);
        
        // Add data
        if (data.totalItems !== undefined) {
          worksheet.addRow(['Total Items', data.totalItems]);
        }
        if (data.lowStockItems !== undefined) {
          worksheet.addRow(['Low Stock Items', data.lowStockItems]);
        }
        if (data.outOfStockItems !== undefined) {
          worksheet.addRow(['Out of Stock Items', data.outOfStockItems]);
        }
        if (data.totalValue !== undefined) {
          worksheet.addRow(['Total Inventory Value', `₹${data.totalValue.toFixed(2)}`]);
        }
        
        // Add inventory by category if available
        if (data.inventoryByCategory && data.inventoryByCategory.length > 0) {
          worksheet.addRow([]);
          worksheet.addRow(['Inventory By Category']);
          worksheet.addRow(['Category', 'Count', 'Value']);
          
          data.inventoryByCategory.forEach(item => {
            worksheet.addRow([item.category, item.count, `₹${item.value.toFixed(2)}`]);
          });
        }
        break;
        
      default:
        worksheet.addRow(['No specific data available for this report type.']);
    }
    
    // Format the worksheet
    worksheet.columns.forEach(column => {
      column.width = 20;
    });
    
    return await workbook.xlsx.writeBuffer();
  } catch (error) {
    console.error('Error generating Excel report:', error);
    throw new Error(`Excel generation failed: ${error.message}`);
  }
}

export {
  getReport,
  getFinancialReport,
  getAppointmentReport,
  getPatientReport,
  getInventoryReport,
  exportReport
};

export default {
  getReport,
  getFinancialReport,
  getAppointmentReport,
  getPatientReport,
  getInventoryReport,
  exportReport
};
