import Branch from '../models/Branch.js';
import { ErrorResponse } from '../utils/errorResponse.js';
import asyncHandler from '../middleware/asyncHandler.js';

// @desc    Create a new branch
// @route   POST /api/branches
// @access  Private/Admin
export const createBranch = asyncHandler(async (req, res) => {
  req.body.clinicId = req.user.clinicId;
  
  // If this is the first branch for this clinic, make it the main branch
  const branchCount = await Branch.countDocuments({ clinicId: req.user.clinicId });
  if (branchCount === 0) {
    req.body.isMainBranch = true;
  }
  
  const branch = await Branch.create(req.body);
  
  res.status(201).json({
    success: true,
    data: branch,
    message: 'Branch created successfully'
  });
});

// @desc    Get all branches for a clinic
// @route   GET /api/branches
// @access  Private
export const getBranches = asyncHandler(async (req, res) => {
  const branches = await Branch.find({ clinicId: req.user.clinicId });
  
  res.status(200).json({
    success: true,
    count: branches.length,
    data: branches
  });
});

// @desc    Get single branch
// @route   GET /api/branches/:id
// @access  Private
export const getBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.findById(req.params.id);
  
  if (!branch) {
    throw new ErrorResponse(`Branch not found with id of ${req.params.id}`, 404);
  }
  
  // Make sure user belongs to branch's clinic
  if (branch.clinicId.toString() !== req.user.clinicId.toString() && req.user.role !== 'Admin') {
    throw new ErrorResponse(`User not authorized to access this branch`, 403);
  }
  
  res.status(200).json({
    success: true,
    data: branch
  });
});

// @desc    Update branch
// @route   PUT /api/branches/:id
// @access  Private/Admin
export const updateBranch = asyncHandler(async (req, res) => {
  let branch = await Branch.findById(req.params.id);
  
  if (!branch) {
    throw new ErrorResponse(`Branch not found with id of ${req.params.id}`, 404);
  }
  
  // Make sure user belongs to branch's clinic
  if (branch.clinicId.toString() !== req.user.clinicId.toString() && req.user.role !== 'Admin') {
    throw new ErrorResponse(`User not authorized to update this branch`, 403);
  }
  
  branch = await Branch.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  
  res.status(200).json({
    success: true,
    data: branch,
    message: 'Branch updated successfully'
  });
});

// @desc    Delete branch
// @route   DELETE /api/branches/:id
// @access  Private/Admin
export const deleteBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.findById(req.params.id);
  
  if (!branch) {
    throw new ErrorResponse(`Branch not found with id of ${req.params.id}`, 404);
  }
  
  // Make sure user belongs to branch's clinic
  if (branch.clinicId.toString() !== req.user.clinicId.toString() && req.user.role !== 'Admin') {
    throw new ErrorResponse(`User not authorized to delete this branch`, 403);
  }
  
  // Check if this is the main branch
  if (branch.isMainBranch) {
    throw new ErrorResponse(`Cannot delete the main branch. Please set another branch as main first.`, 400);
  }
  
  await branch.remove();
  
  res.status(200).json({
    success: true,
    data: {},
    message: 'Branch deleted successfully'
  });
});

// @desc    Set branch as main
// @route   PUT /api/branches/:id/set-main
// @access  Private/Admin
export const setMainBranch = asyncHandler(async (req, res) => {
  let branch = await Branch.findById(req.params.id);
  
  if (!branch) {
    throw new ErrorResponse(`Branch not found with id of ${req.params.id}`, 404);
  }
  
  // Make sure user belongs to branch's clinic
  if (branch.clinicId.toString() !== req.user.clinicId.toString() && req.user.role !== 'Admin') {
    throw new ErrorResponse(`User not authorized to update this branch`, 403);
  }
  
  // Update all branches to not be main
  await Branch.updateMany(
    { clinicId: req.user.clinicId },
    { isMainBranch: false }
  );
  
  // Set this branch as main
  branch = await Branch.findByIdAndUpdate(
    req.params.id,
    { isMainBranch: true },
    { new: true }
  );
  
  res.status(200).json({
    success: true,
    data: branch,
    message: 'Branch set as main successfully'
  });
});

// @desc    Get main branch for a clinic
// @route   GET /api/branches/main
// @access  Private
export const getMainBranch = asyncHandler(async (req, res) => {
  const branch = await Branch.findOne({
    clinicId: req.user.clinicId,
    isMainBranch: true
  });
  
  if (!branch) {
    throw new ErrorResponse(`No main branch found for this clinic`, 404);
  }
  
  res.status(200).json({
    success: true,
    data: branch
  });
});
