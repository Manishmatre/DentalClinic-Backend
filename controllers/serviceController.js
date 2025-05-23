import Service from '../models/Service.js';
import { ErrorResponse } from '../utils/errorResponse.js';
import asyncHandler from '../middleware/asyncHandler.js';
import defaultServices from '../data/defaultServices.js';

// @desc    Create a new service
// @route   POST /api/services
// @access  Private/Admin
export const createService = asyncHandler(async (req, res) => {
  req.body.clinicId = req.user.clinicId;
  
  const service = await Service.create(req.body);
  
  res.status(201).json({
    success: true,
    data: service,
    message: 'Service created successfully'
  });
});

// @desc    Get all services for a clinic
// @route   GET /api/services
// @access  Private
export const getServices = asyncHandler(async (req, res) => {
  // Build query
  const query = { clinicId: req.user.clinicId };
  
  // Filter by category if provided
  if (req.query.category) {
    query.category = req.query.category;
  }
  
  // Filter by status if provided
  if (req.query.status) {
    query.status = req.query.status;
  }
  
  // Filter by branch if provided
  if (req.query.branchId) {
    query.availableInBranches = req.query.branchId;
  }
  
  // Execute query
  const services = await Service.find(query)
    .populate('availableInBranches', 'name address city')
    .sort({ name: 1 });
  
  res.status(200).json({
    success: true,
    count: services.length,
    data: services
  });
});

// @desc    Get single service
// @route   GET /api/services/:id
// @access  Private
export const getService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id)
    .populate('availableInBranches', 'name address city');
  
  if (!service) {
    throw new ErrorResponse(`Service not found with id of ${req.params.id}`, 404);
  }
  
  // Make sure user belongs to service's clinic
  if (service.clinicId.toString() !== req.user.clinicId.toString() && req.user.role !== 'Admin') {
    throw new ErrorResponse(`User not authorized to access this service`, 403);
  }
  
  res.status(200).json({
    success: true,
    data: service
  });
});

// @desc    Update service
// @route   PUT /api/services/:id
// @access  Private/Admin
export const updateService = asyncHandler(async (req, res) => {
  let service = await Service.findById(req.params.id);
  
  if (!service) {
    throw new ErrorResponse(`Service not found with id of ${req.params.id}`, 404);
  }
  
  // Make sure user belongs to service's clinic
  if (service.clinicId.toString() !== req.user.clinicId.toString() && req.user.role !== 'Admin') {
    throw new ErrorResponse(`User not authorized to update this service`, 403);
  }
  
  service = await Service.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  
  res.status(200).json({
    success: true,
    data: service,
    message: 'Service updated successfully'
  });
});

// @desc    Delete service
// @route   DELETE /api/services/:id
// @access  Private/Admin
export const deleteService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  
  if (!service) {
    throw new ErrorResponse(`Service not found with id of ${req.params.id}`, 404);
  }
  
  // Make sure user belongs to service's clinic
  if (service.clinicId.toString() !== req.user.clinicId.toString() && req.user.role !== 'Admin') {
    throw new ErrorResponse(`User not authorized to delete this service`, 403);
  }
  
  // Check if service has appointments
  // This would require a check on the Appointment model
  // For now, we'll just delete the service
  
  await service.remove();
  
  res.status(200).json({
    success: true,
    data: {},
    message: 'Service deleted successfully'
  });
});

// @desc    Get popular services
// @route   GET /api/services/popular
// @access  Private
export const getPopularServices = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  
  const services = await Service.find({ 
    clinicId: req.user.clinicId,
    status: 'active'
  })
  .sort({ popularity: -1 })
  .limit(limit);
  
  res.status(200).json({
    success: true,
    count: services.length,
    data: services
  });
});

// @desc    Update service popularity
// @route   PUT /api/services/:id/popularity
// @access  Private
export const updateServicePopularity = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  
  if (!service) {
    throw new ErrorResponse(`Service not found with id of ${req.params.id}`, 404);
  }
  
  // Make sure user belongs to service's clinic
  if (service.clinicId.toString() !== req.user.clinicId.toString() && req.user.role !== 'Admin') {
    throw new ErrorResponse(`User not authorized to update this service`, 403);
  }
  
  // Increment popularity
  service.popularity += 1;
  await service.save();
  
  res.status(200).json({
    success: true,
    data: service
  });
});

// @desc    Seed default services for a clinic
// @route   POST /api/services/seed
// @access  Private/Admin
export const seedDefaultServices = asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'Admin') {
    throw new ErrorResponse('Only admin users can seed default services', 403);
  }
  
  const clinicId = req.user.clinicId;
  
  if (!clinicId) {
    throw new ErrorResponse('Clinic ID is required to seed services', 400);
  }
  
  // Check if services already exist for this clinic
  const existingServicesCount = await Service.countDocuments({ clinicId });
  
  // Prepare services with clinic ID
  const servicesWithClinicId = defaultServices.map(service => ({
    ...service,
    clinicId
  }));
  
  // Insert services
  const result = await Service.insertMany(servicesWithClinicId, { ordered: false });
  
  res.status(201).json({
    success: true,
    count: result.length,
    message: `Successfully seeded ${result.length} default services for your clinic`,
    data: result
  });
});
