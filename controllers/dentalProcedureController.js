import DentalProcedure from '../models/DentalProcedure.js';
import { InventoryItem as Inventory } from '../models/Inventory.js';
import mongoose from 'mongoose';
import { createTransaction } from './inventoryController.js';

/**
 * Create a new dental procedure
 * @route POST /api/dental/procedures
 * @access Private
 */
const createDentalProcedure = async (req, res) => {
  try {
    const {
      name,
      category,
      description,
      patient,
      dentist,
      date,
      duration,
      inventoryItems,
      notes,
      status
    } = req.body;

    // Validate required fields
    if (!name || !category || !patient || !dentist) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Process inventory items if provided
    let processedInventoryItems = [];
    let totalInventoryCost = 0;

    if (inventoryItems && inventoryItems.length > 0) {
      // Process each inventory item
      for (const item of inventoryItems) {
        // Get the inventory item from database to ensure it exists and has enough quantity
        const inventoryItem = await Inventory.findById(item.item);
        
        if (!inventoryItem) {
          return res.status(404).json({ message: `Inventory item with ID ${item.item} not found` });
        }

        if (inventoryItem.currentQuantity < item.quantity) {
          return res.status(400).json({ 
            message: `Insufficient quantity for ${inventoryItem.name}. Available: ${inventoryItem.currentQuantity}, Requested: ${item.quantity}` 
          });
        }

        // Calculate total cost
        const totalCost = item.quantity * inventoryItem.unitCost;

        // Add to processed items
        processedInventoryItems.push({
          item: inventoryItem._id,
          quantity: item.quantity,
          unitCost: inventoryItem.unitCost,
          totalCost
        });

        totalInventoryCost += totalCost;

        // Create a transaction to reduce inventory quantity
        await createTransaction({
          item: inventoryItem._id,
          transactionType: 'Usage',
          quantity: -item.quantity,
          unitCost: inventoryItem.unitCost,
          totalCost: -totalCost,
          notes: `Used in dental procedure: ${name}`,
          date: date || new Date(),
          clinic: req.user.clinic,
          createdBy: req.user._id
        });

        // Update inventory quantity
        await Inventory.findByIdAndUpdate(
          inventoryItem._id,
          { 
            $inc: { currentQuantity: -item.quantity },
            $set: { updatedBy: req.user._id }
          }
        );
      }
    }

    // Create the dental procedure
    const dentalProcedure = new DentalProcedure({
      name,
      category,
      description,
      patient,
      dentist,
      date: date || new Date(),
      duration,
      inventoryItems: processedInventoryItems,
      totalInventoryCost,
      notes,
      status: status || 'Scheduled',
      clinic: req.user.clinic,
      createdBy: req.user._id
    });

    await dentalProcedure.save();

    res.status(201).json(dentalProcedure);
  } catch (error) {
    console.error('Error creating dental procedure:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get all dental procedures
 * @route GET /api/dental/procedures
 * @access Private
 */
const getDentalProcedures = async (req, res) => {
  try {
    const { 
      search, 
      category, 
      status, 
      startDate, 
      endDate, 
      dentist, 
      patient,
      limit = 100,
      page = 1
    } = req.query;

    // Build query
    const query = { clinic: req.user.clinic };

    // Add filters if provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) query.category = category;
    if (status) query.status = status;
    if (dentist) query.dentist = dentist;
    if (patient) query.patient = patient;

    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get procedures with pagination
    const procedures = await DentalProcedure.find(query)
      .populate('patient', 'firstName lastName')
      .populate('dentist', 'firstName lastName')
      .populate('inventoryItems.item', 'name category')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await DentalProcedure.countDocuments(query);

    res.json({
      procedures,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting dental procedures:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get a single dental procedure by ID
 * @route GET /api/dental/procedures/:id
 * @access Private
 */
const getDentalProcedureById = async (req, res) => {
  try {
    const procedure = await DentalProcedure.findOne({
      _id: req.params.id,
      clinic: req.user.clinic
    })
      .populate('patient', 'firstName lastName')
      .populate('dentist', 'firstName lastName')
      .populate('inventoryItems.item', 'name category unitOfMeasure')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!procedure) {
      return res.status(404).json({ message: 'Dental procedure not found' });
    }

    res.json(procedure);
  } catch (error) {
    console.error('Error getting dental procedure:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Update a dental procedure
 * @route PUT /api/dental/procedures/:id
 * @access Private
 */
const updateDentalProcedure = async (req, res) => {
  try {
    const {
      name,
      category,
      description,
      patient,
      dentist,
      date,
      duration,
      notes,
      status
    } = req.body;

    // Find the procedure
    const procedure = await DentalProcedure.findOne({
      _id: req.params.id,
      clinic: req.user.clinic
    });

    if (!procedure) {
      return res.status(404).json({ message: 'Dental procedure not found' });
    }

    // Update basic fields
    if (name) procedure.name = name;
    if (category) procedure.category = category;
    if (description !== undefined) procedure.description = description;
    if (patient) procedure.patient = patient;
    if (dentist) procedure.dentist = dentist;
    if (date) procedure.date = date;
    if (duration !== undefined) procedure.duration = duration;
    if (notes !== undefined) procedure.notes = notes;
    if (status) procedure.status = status;

    procedure.updatedBy = req.user._id;

    await procedure.save();

    res.json(procedure);
  } catch (error) {
    console.error('Error updating dental procedure:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Delete a dental procedure
 * @route DELETE /api/dental/procedures/:id
 * @access Private
 */
const deleteDentalProcedure = async (req, res) => {
  try {
    const procedure = await DentalProcedure.findOne({
      _id: req.params.id,
      clinic: req.user.clinic
    });

    if (!procedure) {
      return res.status(404).json({ message: 'Dental procedure not found' });
    }

    // If the procedure has used inventory items and is being deleted,
    // we should decide whether to return items to inventory or not.
    // For now, we'll just delete the procedure without returning items.

    await procedure.remove();

    res.json({ message: 'Dental procedure deleted successfully' });
  } catch (error) {
    console.error('Error deleting dental procedure:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Add inventory items to a procedure
 * @route POST /api/dental/procedures/:id/inventory
 * @access Private
 */
const addInventoryItems = async (req, res) => {
  try {
    const { inventoryItems } = req.body;

    if (!inventoryItems || !Array.isArray(inventoryItems) || inventoryItems.length === 0) {
      return res.status(400).json({ message: 'Please provide inventory items' });
    }

    // Find the procedure
    const procedure = await DentalProcedure.findOne({
      _id: req.params.id,
      clinic: req.user.clinic
    });

    if (!procedure) {
      return res.status(404).json({ message: 'Dental procedure not found' });
    }

    // Process each inventory item
    for (const item of inventoryItems) {
      // Get the inventory item from database
      const inventoryItem = await Inventory.findById(item.item);
      
      if (!inventoryItem) {
        return res.status(404).json({ message: `Inventory item with ID ${item.item} not found` });
      }

      if (inventoryItem.currentQuantity < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient quantity for ${inventoryItem.name}. Available: ${inventoryItem.currentQuantity}, Requested: ${item.quantity}` 
        });
      }

      // Calculate total cost
      const totalCost = item.quantity * inventoryItem.unitCost;

      // Add to procedure's inventory items
      procedure.inventoryItems.push({
        item: inventoryItem._id,
        quantity: item.quantity,
        unitCost: inventoryItem.unitCost,
        totalCost
      });

      // Create a transaction to reduce inventory quantity
      await createTransaction({
        item: inventoryItem._id,
        transactionType: 'Usage',
        quantity: -item.quantity,
        unitCost: inventoryItem.unitCost,
        totalCost: -totalCost,
        notes: `Added to dental procedure: ${procedure.name}`,
        date: new Date(),
        clinic: req.user.clinic,
        createdBy: req.user._id
      });

      // Update inventory quantity
      await Inventory.findByIdAndUpdate(
        inventoryItem._id,
        { 
          $inc: { currentQuantity: -item.quantity },
          $set: { updatedBy: req.user._id }
        }
      );
    }

    procedure.updatedBy = req.user._id;
    await procedure.save();

    res.json(procedure);
  } catch (error) {
    console.error('Error adding inventory items to procedure:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get inventory usage report by procedure category
 * @route GET /api/dental/procedures/reports/inventory-usage
 * @access Private
 */
const getInventoryUsageReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date range query
    const dateQuery = {};
    if (startDate) dateQuery.$gte = new Date(startDate);
    if (endDate) dateQuery.$lte = new Date(endDate);

    // Aggregate inventory usage by procedure category
    const usageByCategory = await DentalProcedure.aggregate([
      { 
        $match: { 
          clinic: mongoose.Types.ObjectId(req.user.clinic),
          ...(Object.keys(dateQuery).length > 0 ? { date: dateQuery } : {})
        } 
      },
      { $unwind: '$inventoryItems' },
      {
        $group: {
          _id: '$category',
          totalQuantity: { $sum: '$inventoryItems.quantity' },
          totalCost: { $sum: '$inventoryItems.totalCost' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          category: '$_id',
          totalQuantity: 1,
          totalCost: 1,
          count: 1,
          _id: 0
        }
      },
      { $sort: { totalCost: -1 } }
    ]);

    // Get top used inventory items
    const topItems = await DentalProcedure.aggregate([
      { 
        $match: { 
          clinic: mongoose.Types.ObjectId(req.user.clinic),
          ...(Object.keys(dateQuery).length > 0 ? { date: dateQuery } : {})
        } 
      },
      { $unwind: '$inventoryItems' },
      {
        $group: {
          _id: '$inventoryItems.item',
          totalQuantity: { $sum: '$inventoryItems.quantity' },
          totalCost: { $sum: '$inventoryItems.totalCost' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'inventories',
          localField: '_id',
          foreignField: '_id',
          as: 'itemDetails'
        }
      },
      { $unwind: '$itemDetails' },
      {
        $project: {
          itemId: '$_id',
          name: '$itemDetails.name',
          category: '$itemDetails.category',
          totalQuantity: 1,
          totalCost: 1,
          count: 1,
          _id: 0
        }
      },
      { $sort: { totalCost: -1 } },
      { $limit: 10 }
    ]);

    // Get total inventory cost for all procedures
    const totalCost = await DentalProcedure.aggregate([
      { 
        $match: { 
          clinic: mongoose.Types.ObjectId(req.user.clinic),
          ...(Object.keys(dateQuery).length > 0 ? { date: dateQuery } : {})
        } 
      },
      {
        $group: {
          _id: null,
          totalCost: { $sum: '$totalInventoryCost' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      usageByCategory,
      topItems,
      totalCost: totalCost.length > 0 ? totalCost[0].totalCost : 0,
      procedureCount: totalCost.length > 0 ? totalCost[0].count : 0
    });
  } catch (error) {
    console.error('Error generating inventory usage report:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get inventory usage over time
 * @route GET /api/dental/procedures/reports/inventory-usage-trend
 * @access Private
 */
const getInventoryUsageTrend = async (req, res) => {
  try {
    const { period = 'month', category, limit = 10 } = req.query;

    // Define the date grouping format based on the period
    let dateFormat;
    let dateRange = {};
    const now = new Date();

    switch (period) {
      case 'week':
        // Group by day for the last 7 days
        dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$date' } };
        dateRange = {
          $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
        };
        break;
      case 'month':
        // Group by day for the last 30 days
        dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$date' } };
        dateRange = {
          $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
        };
        break;
      case 'quarter':
        // Group by week for the last 13 weeks
        dateFormat = { 
          $dateToString: { 
            format: '%Y-%U', // Year and week number
            date: '$date' 
          } 
        };
        dateRange = {
          $gte: new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
        };
        break;
      case 'year':
        // Group by month for the last 12 months
        dateFormat = { $dateToString: { format: '%Y-%m', date: '$date' } };
        dateRange = {
          $gte: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
        };
        break;
      default:
        // Default to monthly
        dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$date' } };
        dateRange = {
          $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30)
        };
    }

    // Build the match query
    const matchQuery = { 
      clinic: mongoose.Types.ObjectId(req.user.clinic),
      date: dateRange
    };

    if (category) {
      matchQuery.category = category;
    }

    // Aggregate usage data over time
    const usageOverTime = await DentalProcedure.aggregate([
      { $match: matchQuery },
      { $unwind: '$inventoryItems' },
      {
        $group: {
          _id: {
            date: dateFormat,
            category: '$category'
          },
          totalQuantity: { $sum: '$inventoryItems.quantity' },
          totalCost: { $sum: '$inventoryItems.totalCost' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id.date',
          category: '$_id.category',
          totalQuantity: 1,
          totalCost: 1,
          count: 1
        }
      },
      { $sort: { date: 1 } }
    ]);

    // Get top used items during this period
    const topItems = await DentalProcedure.aggregate([
      { $match: matchQuery },
      { $unwind: '$inventoryItems' },
      {
        $group: {
          _id: '$inventoryItems.item',
          totalQuantity: { $sum: '$inventoryItems.quantity' },
          totalCost: { $sum: '$inventoryItems.totalCost' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'inventories',
          localField: '_id',
          foreignField: '_id',
          as: 'itemDetails'
        }
      },
      { $unwind: '$itemDetails' },
      {
        $project: {
          _id: 0,
          name: '$itemDetails.name',
          category: '$itemDetails.category',
          totalQuantity: 1,
          totalCost: 1,
          count: 1
        }
      },
      { $sort: { totalCost: -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Get usage by category during this period
    const usageByCategory = await DentalProcedure.aggregate([
      { $match: matchQuery },
      { $unwind: '$inventoryItems' },
      {
        $group: {
          _id: '$category',
          totalQuantity: { $sum: '$inventoryItems.quantity' },
          totalCost: { $sum: '$inventoryItems.totalCost' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          name: '$_id',
          totalQuantity: 1,
          totalCost: 1,
          count: 1
        }
      },
      { $sort: { totalCost: -1 } }
    ]);

    res.json({
      usageOverTime,
      topItems,
      usageByCategory,
      period
    });
  } catch (error) {
    console.error('Error generating inventory usage trend:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get common inventory items needed for a specific procedure category
 * @route GET /api/dental/procedures/inventory-items
 * @access Private
 */
const getCommonInventoryItems = async (req, res) => {
  try {
    const { category } = req.query;
    
    if (!category) {
      return res.status(400).json({ message: 'Procedure category is required' });
    }
    
    // Find procedures in this category to analyze commonly used inventory items
    const procedures = await DentalProcedure.find({
      category,
      clinic: req.user.clinic
    }).populate('inventoryItems.item');
    
    // If no procedures found, return default items based on category
    if (procedures.length === 0) {
      // Return default items based on category
      const defaultItems = await getDefaultItemsForCategory(category, req.user.clinic);
      return res.json(defaultItems);
    }
    
    // Analyze inventory items used across these procedures
    const itemUsageMap = {};
    
    procedures.forEach(procedure => {
      procedure.inventoryItems.forEach(item => {
        const itemId = item.item._id.toString();
        
        if (!itemUsageMap[itemId]) {
          itemUsageMap[itemId] = {
            _id: itemId,
            name: item.item.name,
            category: item.item.category,
            subcategory: item.item.subcategory,
            unit: item.item.unit,
            totalQuantity: 0,
            occurrences: 0
          };
        }
        
        itemUsageMap[itemId].totalQuantity += item.quantity;
        itemUsageMap[itemId].occurrences += 1;
      });
    });
    
    // Convert to array and calculate average quantity per procedure
    const commonItems = Object.values(itemUsageMap).map(item => ({
      ...item,
      estimatedQuantity: Math.ceil(item.totalQuantity / item.occurrences)
    }));
    
    // Sort by occurrence frequency
    commonItems.sort((a, b) => b.occurrences - a.occurrences);
    
    // Get current stock levels for these items
    const itemIds = commonItems.map(item => item._id);
    const inventoryItems = await Inventory.find({
      _id: { $in: itemIds },
      clinic: req.user.clinic
    });
    
    // Add current stock information
    const result = commonItems.map(item => {
      const inventoryItem = inventoryItems.find(invItem => invItem._id.toString() === item._id);
      return {
        ...item,
        currentStock: inventoryItem ? inventoryItem.currentStock : 0
      };
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error getting common inventory items:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Helper function to get default inventory items for a procedure category
 * @param {string} category - The procedure category
 * @param {string} clinicId - The clinic ID
 * @returns {Promise<Array>} - Default inventory items
 */
const getDefaultItemsForCategory = async (category, clinicId) => {
  // Define default items based on procedure category
  let searchTerms = [];
  
  switch (category) {
    case 'Diagnostic':
      searchTerms = ['mirror', 'explorer', 'probe', 'x-ray'];
      break;
    case 'Preventive':
      searchTerms = ['fluoride', 'sealant', 'prophy', 'paste'];
      break;
    case 'Restorative':
      searchTerms = ['composite', 'amalgam', 'cement', 'matrix'];
      break;
    case 'Endodontic':
      searchTerms = ['file', 'gutta percha', 'sealer', 'irrigant'];
      break;
    case 'Periodontic':
      searchTerms = ['scaler', 'curette', 'periodontal', 'dressing'];
      break;
    case 'Prosthodontic':
      searchTerms = ['impression', 'tray', 'wax', 'articulator'];
      break;
    case 'Oral Surgery':
      searchTerms = ['forceps', 'elevator', 'suture', 'scalpel'];
      break;
    case 'Orthodontic':
      searchTerms = ['bracket', 'wire', 'band', 'elastic'];
      break;
    case 'Implant':
      searchTerms = ['implant', 'abutment', 'analog', 'driver'];
      break;
    default:
      searchTerms = ['gloves', 'mask', 'bib', 'cotton'];
  }
  
  // Find inventory items matching these search terms
  const searchQueries = searchTerms.map(term => ({
    name: { $regex: term, $options: 'i' }
  }));
  
  const inventoryItems = await Inventory.find({
    $or: searchQueries,
    clinic: clinicId
  });
  
  // If no specific items found, get general dental supplies
  if (inventoryItems.length === 0) {
    const generalItems = await Inventory.find({
      category: 'Dental Supplies',
      clinic: clinicId
    }).limit(5);
    
    return generalItems.map(item => ({
      _id: item._id,
      name: item.name,
      category: item.category,
      subcategory: item.subcategory,
      unit: item.unit,
      estimatedQuantity: 1,
      currentStock: item.currentStock
    }));
  }
  
  // Format the results
  return inventoryItems.map(item => ({
    _id: item._id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    unit: item.unit,
    estimatedQuantity: 1,
    currentStock: item.currentStock
  }));
};

export {
  createDentalProcedure,
  getDentalProcedures,
  getDentalProcedureById,
  updateDentalProcedure,
  deleteDentalProcedure,
  addInventoryItems,
  getInventoryUsageReport,
  getInventoryUsageTrend,
  getCommonInventoryItems
};
