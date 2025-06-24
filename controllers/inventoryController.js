import { InventoryItem, InventoryTransaction } from '../models/Inventory.js';
import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';

// @desc    Create a new inventory item
// @route   POST /api/inventory/items
// @access  Private (Admin)
const createInventoryItem = asyncHandler(async (req, res) => {
  const {
    name,
    category,
    description,
    unitOfMeasure,
    currentQuantity,
    reorderLevel,
    idealQuantity,
    unitCost,
    expiryDate,
    location,
    supplier,
    notes
  } = req.body;

  // Create inventory item
  const inventoryItem = await InventoryItem.create({
    name,
    category,
    description,
    unitOfMeasure,
    currentQuantity,
    reorderLevel,
    idealQuantity,
    unitCost,
    expiryDate,
    location,
    supplier,
    notes,
    clinicId: req.user.clinicId
  });

  // Create initial inventory transaction for the new item
  if (currentQuantity > 0) {
    await InventoryTransaction.create({
      itemId: inventoryItem._id,
      transactionType: 'Purchase',
      quantity: currentQuantity,
      unitCost,
      totalCost: currentQuantity * unitCost,
      notes: 'Initial inventory',
      performedBy: req.user._id,
      clinicId: req.user.clinicId
    });
  }

  res.status(201).json(inventoryItem);
});

// @desc    Get all inventory items
// @route   GET /api/inventory/items
// @access  Private (Admin, Doctor, Staff)
const getInventoryItems = asyncHandler(async (req, res) => {
  const { category, search, lowStock, status, expiringSoon, supplier, shade, size } = req.query;
  const query = { clinicId: req.user.clinicId };

  // Filter by category
  if (category) {
    query.category = category;
  }

  // Filter by active status
  if (status) {
    query.isActive = status === 'active';
  }

  // Filter by low stock
  if (lowStock === 'true') {
    query.currentQuantity = { $lte: '$reorderLevel' };
  }

  // Filter by expiring soon
  if (expiringSoon === 'true') {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    query.expiryDate = { $gte: today, $lte: thirtyDaysFromNow };
  }

  // Filter by supplier
  if (supplier) {
    query['supplier.name'] = { $regex: supplier, $options: 'i' };
  }

  // Filter by dental-specific fields
  if (shade) {
    query['dentalSpecific.shade'] = { $regex: shade, $options: 'i' };
  }

  if (size) {
    query['dentalSpecific.size'] = { $regex: size, $options: 'i' };
  }

  // Search by name or item code
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { itemCode: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const inventoryItems = await InventoryItem.find(query).sort({ name: 1 });

  res.json(inventoryItems);
});

// @desc    Get a single inventory item
// @route   GET /api/inventory/items/:id
// @access  Private (Admin, Doctor, Staff)
const getInventoryItemById = asyncHandler(async (req, res) => {
  const inventoryItem = await InventoryItem.findById(req.params.id);

  if (!inventoryItem) {
    res.status(404);
    throw new Error('Inventory item not found');
  }

  // Ensure user has access to this clinic's inventory
  if (inventoryItem.clinicId.toString() !== req.user.clinicId.toString()) {
    res.status(403);
    throw new Error('Not authorized to access this inventory item');
  }

  res.json(inventoryItem);
});

// @desc    Update an inventory item
// @route   PUT /api/inventory/items/:id
// @access  Private (Admin)
const updateInventoryItem = asyncHandler(async (req, res) => {
  const inventoryItem = await InventoryItem.findById(req.params.id);

  if (!inventoryItem) {
    res.status(404);
    throw new Error('Inventory item not found');
  }

  // Ensure user has access to this clinic's inventory
  if (inventoryItem.clinicId.toString() !== req.user.clinicId.toString()) {
    res.status(403);
    throw new Error('Not authorized to update this inventory item');
  }

  // Check if quantity is being updated
  const oldQuantity = inventoryItem.currentQuantity;
  const newQuantity = req.body.currentQuantity !== undefined ? req.body.currentQuantity : oldQuantity;

  // Update inventory item
  const updatedItem = await InventoryItem.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  // Create inventory transaction if quantity changed
  if (newQuantity !== oldQuantity) {
    const quantityChange = newQuantity - oldQuantity;
    await InventoryTransaction.create({
      itemId: inventoryItem._id,
      transactionType: 'Adjustment',
      quantity: quantityChange,
      unitCost: inventoryItem.unitCost,
      totalCost: Math.abs(quantityChange) * inventoryItem.unitCost,
      notes: req.body.notes || 'Quantity adjustment',
      performedBy: req.user._id,
      clinicId: req.user.clinicId
    });
  }

  res.json(updatedItem);
});

// @desc    Delete an inventory item
// @route   DELETE /api/inventory/items/:id
// @access  Private (Admin)
const deleteInventoryItem = asyncHandler(async (req, res) => {
  const inventoryItem = await InventoryItem.findById(req.params.id);

  if (!inventoryItem) {
    res.status(404);
    throw new Error('Inventory item not found');
  }

  // Ensure user has access to this clinic's inventory
  if (inventoryItem.clinicId.toString() !== req.user.clinicId.toString()) {
    res.status(403);
    throw new Error('Not authorized to delete this inventory item');
  }

  // Instead of hard deleting, mark as inactive
  inventoryItem.isActive = false;
  await inventoryItem.save();

  res.json({ message: 'Inventory item marked as inactive' });
});

// @desc    Create an inventory transaction
// @route   POST /api/inventory/transactions
// @access  Private (Admin, Staff)
const createInventoryTransaction = asyncHandler(async (req, res) => {
  const {
    itemId,
    transactionType,
    quantity,
    unitCost,
    referenceNumber,
    notes
  } = req.body;

  // Verify inventory item exists
  const inventoryItem = await InventoryItem.findById(itemId);
  if (!inventoryItem) {
    res.status(404);
    throw new Error('Inventory item not found');
  }

  // Ensure user has access to this clinic's inventory
  if (inventoryItem.clinicId.toString() !== req.user.clinicId.toString()) {
    res.status(403);
    throw new Error('Not authorized to create transaction for this inventory item');
  }

  // Calculate total cost
  const totalCost = Math.abs(quantity) * (unitCost || inventoryItem.unitCost);

  // Create transaction
  const transaction = await InventoryTransaction.create({
    itemId,
    transactionType,
    quantity,
    unitCost: unitCost || inventoryItem.unitCost,
    totalCost,
    referenceNumber,
    notes,
    performedBy: req.user._id,
    clinicId: req.user.clinicId
  });

  // Update inventory item quantity
  inventoryItem.currentQuantity += quantity;
  if (inventoryItem.currentQuantity < 0) {
    inventoryItem.currentQuantity = 0; // Prevent negative quantities
  }
  
  // Update unit cost for purchases
  if (transactionType === 'Purchase' && unitCost) {
    inventoryItem.unitCost = unitCost;
  }
  
  await inventoryItem.save();

  res.status(201).json(transaction);
});

// @desc    Get inventory transactions
// @route   GET /api/inventory/transactions
// @access  Private (Admin, Staff)
const getInventoryTransactions = asyncHandler(async (req, res) => {
  const { itemId, type, startDate, endDate } = req.query;
  const query = { clinicId: req.user.clinicId };

  // Filter by item
  if (itemId) {
    query.itemId = itemId;
  }

  // Filter by transaction type
  if (type) {
    query.transactionType = type;
  }

  // Filter by date range
  if (startDate || endDate) {
    query.date = {};
    if (startDate) {
      query.date.$gte = new Date(startDate);
    }
    if (endDate) {
      query.date.$lte = new Date(endDate);
    }
  }

  const transactions = await InventoryTransaction.find(query)
    .populate('itemId', 'name itemCode category')
    .populate('performedBy', 'name')
    .sort({ date: -1 });

  res.json(transactions);
});

// @desc    Get transactions for a specific inventory item
// @route   GET /api/inventory/transactions/item/:itemId
// @access  Private (Admin, Staff)
const getTransactionsByItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;

  // Verify inventory item exists
  const inventoryItem = await InventoryItem.findById(itemId);
  if (!inventoryItem) {
    res.status(404);
    throw new Error('Inventory item not found');
  }

  // Ensure user has access to this clinic's inventory
  if (inventoryItem.clinicId.toString() !== req.user.clinicId.toString()) {
    res.status(403);
    throw new Error('Not authorized to view transactions for this inventory item');
  }

  const transactions = await InventoryTransaction.find({ itemId })
    .populate('performedBy', 'name')
    .sort({ date: -1 });

  res.json(transactions);
});

// @desc    Get inventory statistics
// @route   GET /api/inventory/stats
// @access  Private (Admin)
const getInventoryStats = asyncHandler(async (req, res) => {
  const clinicId = req.user.clinicId;

  // Count total items
  const totalItems = await InventoryItem.countDocuments({ clinicId, isActive: true });

  // Count low stock items
  const lowStockItems = await InventoryItem.countDocuments({
    clinicId,
    isActive: true,
    $expr: { $lte: ['$currentQuantity', '$reorderLevel'] }
  });

  // Count out of stock items
  const outOfStockItems = await InventoryItem.countDocuments({
    clinicId,
    isActive: true,
    currentQuantity: 0
  });

  // Calculate total inventory value
  const inventoryItems = await InventoryItem.find({ clinicId, isActive: true });
  const totalValue = inventoryItems.reduce((sum, item) => {
    return sum + (item.currentQuantity * item.unitCost);
  }, 0);

  // Get category distribution
  const categoryDistribution = await InventoryItem.aggregate([
    { $match: { clinicId: mongoose.Types.ObjectId(clinicId), isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  // Get recent transactions
  const recentTransactions = await InventoryTransaction.find({ clinicId })
    .populate('itemId', 'name itemCode')
    .populate('performedBy', 'name')
    .sort({ createdAt: -1 })
    .limit(5);

  res.json({
    totalItems,
    lowStockItems,
    outOfStockItems,
    totalValue,
    categoryDistribution,
    recentTransactions
  });
});

// @desc    Get dental inventory statistics
// @route   GET /api/inventory/dental-stats
// @access  Private (Admin)
const getDentalInventoryStats = asyncHandler(async (req, res) => {
  const clinicId = req.user.clinicId;

  // Count total dental items
  const totalDentalItems = await InventoryItem.countDocuments({
    clinicId,
    isActive: true,
    category: { $in: ['Dental Material', 'Dental Instrument', 'Dental Equipment'] }
  });

  // Count expiring soon items
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);
  
  const expiringSoonItems = await InventoryItem.countDocuments({
    clinicId,
    isActive: true,
    expiryDate: { $gte: today, $lte: thirtyDaysFromNow }
  });

  // Count low stock dental items
  const lowStockDentalItems = await InventoryItem.countDocuments({
    clinicId,
    isActive: true,
    category: { $in: ['Dental Material', 'Dental Instrument', 'Dental Equipment'] },
    $expr: { $lte: ['$currentQuantity', '$reorderLevel'] }
  });

  // Get dental category distribution
  const dentalCategoryDistribution = await InventoryItem.aggregate([
    { 
      $match: { 
        clinicId: mongoose.Types.ObjectId(clinicId), 
        isActive: true,
        category: { $in: ['Dental Material', 'Dental Instrument', 'Dental Equipment'] }
      } 
    },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  // Get top 5 most used dental items (based on transactions)
  const mostUsedItems = await InventoryTransaction.aggregate([
    { 
      $match: { 
        clinicId: mongoose.Types.ObjectId(clinicId),
        transactionType: 'Usage'
      } 
    },
    { $group: { _id: '$itemId', totalUsed: { $sum: { $abs: '$quantity' } } } },
    { $sort: { totalUsed: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'inventoryitems',
        localField: '_id',
        foreignField: '_id',
        as: 'itemDetails'
      }
    },
    { $unwind: '$itemDetails' },
    {
      $project: {
        _id: 0,
        itemId: '$_id',
        name: '$itemDetails.name',
        category: '$itemDetails.category',
        totalUsed: 1
      }
    }
  ]);

  // Get recent dental inventory transactions
  const recentDentalTransactions = await InventoryTransaction.find({ clinicId })
    .populate({
      path: 'itemId',
      match: { category: { $in: ['Dental Material', 'Dental Instrument', 'Dental Equipment'] } },
      select: 'name itemCode category'
    })
    .populate('performedBy', 'name')
    .sort({ createdAt: -1 })
    .limit(10);

  // Filter out transactions where itemId is null (non-dental items)
  const filteredTransactions = recentDentalTransactions.filter(t => t.itemId);

  res.json({
    totalDentalItems,
    lowStockDentalItems,
    expiringSoonItems,
    dentalCategoryDistribution,
    mostUsedItems,
    recentTransactions: filteredTransactions
  });
});

// Helper function to create a transaction (used by other controllers)
const createTransaction = async (transactionData) => {
  const transaction = await InventoryTransaction.create(transactionData);
  return transaction;
};

export {
  createInventoryItem,
  getInventoryItems,
  getInventoryItemById,
  updateInventoryItem,
  deleteInventoryItem,
  createInventoryTransaction,
  getInventoryTransactions,
  getTransactionsByItem,
  getInventoryStats,
  getDentalInventoryStats,
  createTransaction
};