import { InventoryItem, InventoryTransaction } from '../models/Inventory.js';
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';

/**
 * @desc    Get dental categories
 * @route   GET /api/inventory/dental/categories
 * @access  Private (Admin, Doctor, Staff)
 */
const getDentalCategories = asyncHandler(async (req, res) => {
  const categories = [
    'Dental Material', 
    'Dental Instrument', 
    'Dental Equipment', 
    'Sterilization Supply', 
    'Disposable', 
    'Medication',
    'Office Supply', 
    'Other'
  ];
  
  res.json(categories);
});

/**
 * @desc    Get dental suppliers
 * @route   GET /api/inventory/dental/suppliers
 * @access  Private (Admin, Doctor, Staff)
 */
const getDentalSuppliers = asyncHandler(async (req, res) => {
  const clinicId = req.user.clinicId;
  
  // Aggregate unique suppliers from the inventory
  const suppliers = await InventoryItem.aggregate([
    { $match: { clinicId: mongoose.Types.ObjectId(clinicId) } },
    { $group: { _id: '$supplier.name' } },
    { $match: { _id: { $ne: null, $ne: '' } } },
    { $sort: { _id: 1 } }
  ]);
  
  res.json(suppliers.map(s => s._id));
});

/**
 * @desc    Get expiring dental items
 * @route   GET /api/inventory/dental/expiring
 * @access  Private (Admin, Doctor, Staff)
 */
const getExpiringItems = asyncHandler(async (req, res) => {
  const clinicId = req.user.clinicId;
  const { days } = req.query;
  
  // Default to 30 days if not specified
  const daysToExpiry = parseInt(days) || 30;
  
  const today = new Date();
  const expiryDate = new Date();
  expiryDate.setDate(today.getDate() + daysToExpiry);
  
  const expiringItems = await InventoryItem.find({
    clinicId,
    isActive: true,
    expiryDate: { $gte: today, $lte: expiryDate }
  }).sort({ expiryDate: 1 });
  
  res.json(expiringItems);
});

/**
 * @desc    Get dental inventory dashboard data
 * @route   GET /api/inventory/dental/dashboard
 * @access  Private (Admin)
 */
const getDentalDashboard = asyncHandler(async (req, res) => {
  const clinicId = req.user.clinicId;
  
  // Get counts for different categories
  const categoryCounts = await InventoryItem.aggregate([
    { 
      $match: { 
        clinicId: mongoose.Types.ObjectId(clinicId),
        isActive: true
      } 
    },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  
  // Get low stock items count
  const lowStockCount = await InventoryItem.countDocuments({
    clinicId,
    isActive: true,
    $expr: { $lte: ['$currentQuantity', '$reorderLevel'] }
  });
  
  // Get expiring soon items
  const today = new Date();
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(today.getDate() + 30);
  
  const expiringCount = await InventoryItem.countDocuments({
    clinicId,
    isActive: true,
    expiryDate: { $gte: today, $lte: thirtyDaysLater }
  });
  
  // Get total inventory value
  const inventoryItems = await InventoryItem.find({ 
    clinicId, 
    isActive: true 
  });
  
  const totalValue = inventoryItems.reduce((sum, item) => {
    return sum + (item.currentQuantity * item.unitCost);
  }, 0);
  
  // Get recent transactions
  const recentTransactions = await InventoryTransaction.find({ clinicId })
    .populate('itemId', 'name itemCode category')
    .populate('performedBy', 'name')
    .sort({ createdAt: -1 })
    .limit(5);
  
  res.json({
    categoryCounts,
    lowStockCount,
    expiringCount,
    totalValue,
    recentTransactions
  });
});

/**
 * @desc    Get dental inventory usage report
 * @route   GET /api/inventory/dental/usage-report
 * @access  Private (Admin)
 */
const getUsageReport = asyncHandler(async (req, res) => {
  const clinicId = req.user.clinicId;
  const { startDate, endDate, category } = req.query;
  
  const query = { 
    clinicId: mongoose.Types.ObjectId(clinicId),
    transactionType: 'Usage'
  };
  
  // Add date range if provided
  if (startDate || endDate) {
    query.date = {};
    if (startDate) {
      query.date.$gte = new Date(startDate);
    }
    if (endDate) {
      query.date.$lte = new Date(endDate);
    }
  }
  
  // Get usage data
  const usageData = await InventoryTransaction.aggregate([
    { $match: query },
    {
      $lookup: {
        from: 'inventoryitems',
        localField: 'itemId',
        foreignField: '_id',
        as: 'item'
      }
    },
    { $unwind: '$item' },
    // Filter by category if provided
    ...(category ? [{ $match: { 'item.category': category } }] : []),
    {
      $group: {
        _id: '$itemId',
        itemName: { $first: '$item.name' },
        itemCode: { $first: '$item.itemCode' },
        category: { $first: '$item.category' },
        totalQuantity: { $sum: { $abs: '$quantity' } },
        totalCost: { $sum: { $abs: { $multiply: ['$quantity', '$unitCost'] } } }
      }
    },
    { $sort: { totalQuantity: -1 } }
  ]);
  
  res.json(usageData);
});

export {
  getDentalCategories,
  getDentalSuppliers,
  getExpiringItems,
  getDentalDashboard,
  getUsageReport
};
