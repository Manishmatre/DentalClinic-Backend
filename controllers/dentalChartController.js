import DentalChart from '../models/DentalChart.js';
import ToothRecord from '../models/ToothRecord.js';
import mongoose from 'mongoose';
import { createAuditLog } from '../utils/auditLogger.js';

// Get dental chart for a patient
export const getPatientDentalChart = async (req, res) => {
  try {
    const { patientId } = req.params;
    const clinicId = req.user.clinicId;
    
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: 'Invalid patient ID format' });
    }
    
    // Find or create dental chart
    let chart = await DentalChart.findOne({ patientId, clinicId });
    
    if (!chart) {
      chart = await DentalChart.create({
        patientId,
        clinicId,
        createdBy: req.user._id,
        notes: 'Initial chart creation'
      });
      
      // Create audit log
      createAuditLog({
        action: 'create',
        resourceType: 'DentalChart',
        resourceId: chart._id,
        userId: req.user._id,
        clinicId,
        details: 'Dental chart created'
      });
    }
    
    // Get all tooth records for this chart
    const toothRecords = await ToothRecord.find({ chartId: chart._id });
    
    res.status(200).json({
      success: true,
      data: {
        chart,
        teeth: toothRecords
      }
    });
  } catch (error) {
    console.error('Error fetching dental chart:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch dental chart',
      error: error.message 
    });
  }
};

// Create or update tooth record
export const updateToothRecord = async (req, res) => {
  try {
    const { chartId, toothNumber } = req.params;
    const { quadrant, condition, surfaces, notes, type } = req.body;
    const clinicId = req.user.clinicId;
    
    if (!mongoose.Types.ObjectId.isValid(chartId)) {
      return res.status(400).json({ message: 'Invalid chart ID format' });
    }
    
    // Verify chart belongs to this clinic
    const chart = await DentalChart.findOne({ _id: chartId, clinicId });
    if (!chart) {
      return res.status(404).json({ message: 'Dental chart not found or access denied' });
    }
    
    // Find existing tooth record or create new one
    let toothRecord = await ToothRecord.findOne({ chartId, toothNumber });
    let action = 'update';
    
    if (toothRecord) {
      // Update existing record
      toothRecord.condition = condition || toothRecord.condition;
      toothRecord.surfaces = surfaces || toothRecord.surfaces;
      toothRecord.notes = notes || toothRecord.notes;
      toothRecord.quadrant = quadrant || toothRecord.quadrant;
      toothRecord.type = type || toothRecord.type;
      await toothRecord.save();
    } else {
      // Create new record
      action = 'create';
      toothRecord = await ToothRecord.create({
        chartId,
        toothNumber,
        quadrant: quadrant || determineQuadrant(toothNumber),
        condition: condition || 'healthy',
        surfaces: surfaces || [],
        notes: notes || '',
        type: type || 'adult'
      });
    }
    
    // Update chart's lastUpdated
    await DentalChart.findByIdAndUpdate(chartId, { 
      lastUpdated: Date.now(),
      $set: { 'updatedBy': req.user._id }
    });
    
    // Create audit log
    createAuditLog({
      action,
      resourceType: 'ToothRecord',
      resourceId: toothRecord._id,
      userId: req.user._id,
      clinicId,
      details: `Tooth #${toothNumber} ${action === 'create' ? 'created' : 'updated'}`
    });
    
    res.status(200).json({
      success: true,
      data: toothRecord
    });
  } catch (error) {
    console.error('Error updating tooth record:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update tooth record',
      error: error.message 
    });
  }
};

// Add treatment to tooth
export const addTreatment = async (req, res) => {
  try {
    const { chartId, toothNumber } = req.params;
    const { procedure, procedureCode, surfaces, materials, notes, images } = req.body;
    const clinicId = req.user.clinicId;
    
    if (!mongoose.Types.ObjectId.isValid(chartId)) {
      return res.status(400).json({ message: 'Invalid chart ID format' });
    }
    
    // Verify chart belongs to this clinic
    const chart = await DentalChart.findOne({ _id: chartId, clinicId });
    if (!chart) {
      return res.status(404).json({ message: 'Dental chart not found or access denied' });
    }
    
    const toothRecord = await ToothRecord.findOne({ chartId, toothNumber });
    
    if (!toothRecord) {
      return res.status(404).json({ message: 'Tooth record not found' });
    }
    
    // Add new treatment
    const newTreatment = {
      date: new Date(),
      procedure,
      procedureCode,
      surfaces: surfaces || [],
      materials: materials || '',
      notes: notes || '',
      performedBy: req.user._id,
      images: images || []
    };
    
    toothRecord.treatments.push(newTreatment);
    await toothRecord.save();
    
    // Update chart's lastUpdated
    await DentalChart.findByIdAndUpdate(chartId, { 
      lastUpdated: Date.now(),
      $set: { 'updatedBy': req.user._id }
    });
    
    // Create audit log
    createAuditLog({
      action: 'create',
      resourceType: 'Treatment',
      resourceId: toothRecord._id,
      userId: req.user._id,
      clinicId,
      details: `Treatment (${procedure}) added to tooth #${toothNumber}`
    });
    
    res.status(200).json({
      success: true,
      data: toothRecord
    });
  } catch (error) {
    console.error('Error adding treatment:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to add treatment',
      error: error.message 
    });
  }
};

// Get all treatments for a patient
export const getPatientTreatments = async (req, res) => {
  try {
    const { patientId } = req.params;
    const clinicId = req.user.clinicId;
    
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: 'Invalid patient ID format' });
    }
    
    // Find the dental chart
    const chart = await DentalChart.findOne({ patientId, clinicId });
    
    if (!chart) {
      return res.status(404).json({ message: 'Dental chart not found' });
    }
    
    // Get all tooth records with treatments
    const toothRecords = await ToothRecord.find({ 
      chartId: chart._id,
      'treatments.0': { $exists: true } // Only teeth with treatments
    }).populate('treatments.performedBy', 'name');
    
    // Extract and flatten treatments
    const treatments = [];
    toothRecords.forEach(tooth => {
      tooth.treatments.forEach(treatment => {
        treatments.push({
          toothNumber: tooth.toothNumber,
          quadrant: tooth.quadrant,
          ...treatment.toJSON(),
          id: treatment._id
        });
      });
    });
    
    // Sort by date (newest first)
    treatments.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.status(200).json({
      success: true,
      data: treatments
    });
  } catch (error) {
    console.error('Error fetching patient treatments:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch patient treatments',
      error: error.message 
    });
  }
};

// Helper function to determine quadrant based on tooth number
function determineQuadrant(toothNumber) {
  const num = parseInt(toothNumber);
  if (num >= 1 && num <= 8) return 'upper-right';
  if (num >= 9 && num <= 16) return 'upper-left';
  if (num >= 17 && num <= 24) return 'lower-left';
  if (num >= 25 && num <= 32) return 'lower-right';
  return 'upper-right'; // Default
}
