import Role from '../models/Role.js';
import User from '../models/User.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { ErrorResponse } from '../utils/errorResponse.js';

// @desc    Get all roles
// @route   GET /api/roles
// @access  Private (Admin)
export const getRoles = asyncHandler(async (req, res) => {
  const { clinicId } = req.query;
  
  // Validate user has access to this clinic
  if (req.user.clinicId.toString() !== clinicId && req.user.role !== 'Admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to access roles for this clinic'
    });
  }
  
  // Find roles for the clinic
  const roles = await Role.find({ clinicId }).sort('name');
  
  res.status(200).json(roles);
});

// @desc    Get role by ID
// @route   GET /api/roles/:id
// @access  Private (Admin)
export const getRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  
  if (!role) {
    return res.status(404).json({
      success: false,
      message: 'Role not found'
    });
  }
  
  // Validate user has access to this clinic
  if (req.user.clinicId.toString() !== role.clinicId.toString() && req.user.role !== 'Admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to access this role'
    });
  }
  
  res.status(200).json(role);
});

// @desc    Create new role
// @route   POST /api/roles
// @access  Private (Admin)
export const createRole = asyncHandler(async (req, res) => {
  const { name, description, permissions, clinicId } = req.body;
  
  // Validate user has access to this clinic
  if (req.user.clinicId.toString() !== clinicId && req.user.role !== 'Admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to create roles for this clinic'
    });
  }
  
  // Check if role already exists
  const existingRole = await Role.findOne({ name, clinicId });
  if (existingRole) {
    return res.status(400).json({
      success: false,
      message: 'Role with this name already exists'
    });
  }
  
  // Create role
  const role = await Role.create({
    name,
    description,
    permissions,
    clinicId,
    createdBy: req.user._id
  });
  
  res.status(201).json(role);
});

// @desc    Update role
// @route   PUT /api/roles/:id
// @access  Private (Admin)
export const updateRole = asyncHandler(async (req, res) => {
  const { name, description, permissions } = req.body;
  
  // Find role
  let role = await Role.findById(req.params.id);
  
  if (!role) {
    return res.status(404).json({
      success: false,
      message: 'Role not found'
    });
  }
  
  // Validate user has access to this clinic
  if (req.user.clinicId.toString() !== role.clinicId.toString() && req.user.role !== 'Admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this role'
    });
  }
  
  // Prevent updating default roles
  if (role.isDefault) {
    return res.status(400).json({
      success: false,
      message: 'Default roles cannot be modified'
    });
  }
  
  // Update role
  role = await Role.findByIdAndUpdate(
    req.params.id,
    { name, description, permissions },
    { new: true, runValidators: true }
  );
  
  res.status(200).json(role);
});

// @desc    Delete role
// @route   DELETE /api/roles/:id
// @access  Private (Admin)
export const deleteRole = asyncHandler(async (req, res) => {
  // Find role
  const role = await Role.findById(req.params.id);
  
  if (!role) {
    return res.status(404).json({
      success: false,
      message: 'Role not found'
    });
  }
  
  // Validate user has access to this clinic
  if (req.user.clinicId.toString() !== role.clinicId.toString() && req.user.role !== 'Admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this role'
    });
  }
  
  // Prevent deleting default roles
  if (role.isDefault) {
    return res.status(400).json({
      success: false,
      message: 'Default roles cannot be deleted'
    });
  }
  
  // Check if any users have this role
  const usersWithRole = await User.countDocuments({ role: role.name });
  if (usersWithRole > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete role. ${usersWithRole} users are currently assigned to this role.`
    });
  }
  
  // Delete role
  await role.deleteOne();
  
  res.status(200).json({
    success: true,
    message: 'Role deleted successfully'
  });
});

// @desc    Get all permissions
// @route   GET /api/roles/permissions
// @access  Private (Admin)
export const getPermissions = asyncHandler(async (req, res) => {
  // Define all available permissions grouped by category
  const permissions = [
    // Patient permissions
    { id: 'view_patients', name: 'View Patients', category: 'patients' },
    { id: 'add_patients', name: 'Add Patients', category: 'patients' },
    { id: 'edit_patients', name: 'Edit Patients', category: 'patients' },
    { id: 'delete_patients', name: 'Delete Patients', category: 'patients' },
    { id: 'view_own_records', name: 'View Own Records', category: 'patients' },
    
    // Appointment permissions
    { id: 'view_appointments', name: 'View Appointments', category: 'appointments' },
    { id: 'schedule_appointments', name: 'Schedule Appointments', category: 'appointments' },
    { id: 'cancel_appointments', name: 'Cancel Appointments', category: 'appointments' },
    { id: 'book_appointments', name: 'Book Appointments', category: 'appointments' },
    
    // Billing permissions
    { id: 'view_invoices', name: 'View Invoices', category: 'billing' },
    { id: 'create_invoices', name: 'Create Invoices', category: 'billing' },
    { id: 'process_payments', name: 'Process Payments', category: 'billing' },
    { id: 'view_financial_reports', name: 'View Financial Reports', category: 'billing' },
    
    // Staff permissions
    { id: 'view_staff', name: 'View Staff', category: 'staff' },
    { id: 'add_staff', name: 'Add Staff', category: 'staff' },
    { id: 'edit_staff', name: 'Edit Staff', category: 'staff' },
    { id: 'delete_staff', name: 'Delete Staff', category: 'staff' },
    
    // Inventory permissions
    { id: 'view_inventory', name: 'View Inventory', category: 'inventory' },
    { id: 'add_inventory', name: 'Add Inventory Items', category: 'inventory' },
    { id: 'edit_inventory', name: 'Edit Inventory Items', category: 'inventory' },
    { id: 'delete_inventory', name: 'Delete Inventory Items', category: 'inventory' },
    { id: 'manage_inventory_transactions', name: 'Manage Inventory Transactions', category: 'inventory' },
    
    // Reports permissions
    { id: 'view_reports', name: 'View Reports', category: 'reports' },
    { id: 'export_reports', name: 'Export Reports', category: 'reports' },
    
    // Admin permissions
    { id: 'manage_roles', name: 'Manage Roles', category: 'admin' },
    { id: 'view_dashboard', name: 'View Dashboard', category: 'admin' },
    { id: 'manage_clinic_settings', name: 'Manage Clinic Settings', category: 'admin' },
    { id: 'manage_clinic', name: 'Manage Clinic', category: 'admin' },
    { id: 'view_reports', name: 'View Reports', category: 'admin' },
    { id: 'all', name: 'All Permissions', category: 'admin' }
  ];
  
  res.status(200).json(permissions);
});

// @desc    Assign role to user
// @route   POST /api/roles/assign
// @access  Private (Admin)
export const assignRole = asyncHandler(async (req, res) => {
  const { userId, roleId, clinicId } = req.body;
  
  // Validate required fields
  if (!userId || !roleId) {
    return res.status(400).json({
      success: false,
      message: 'User ID and Role ID are required'
    });
  }
  
  // Find the role
  const role = await Role.findById(roleId);
  if (!role) {
    return res.status(404).json({
      success: false,
      message: 'Role not found'
    });
  }
  
  // Find the user
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  // Validate user has access to this clinic
  if (req.user.clinicId.toString() !== user.clinicId.toString() && req.user.role !== 'Admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to assign roles for this user'
    });
  }
  
  // Ensure user and role belong to the same clinic
  if (user.clinicId.toString() !== role.clinicId.toString()) {
    return res.status(400).json({
      success: false,
      message: 'User and role must belong to the same clinic'
    });
  }
  
  // Update user's role
  user.role = role.name;
  await user.save();
  
  res.status(200).json({
    success: true,
    message: `Role '${role.name}' successfully assigned to user`,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

// @desc    Initialize default roles for a clinic
// @route   POST /api/roles/initialize
// @access  Private (Admin)
export const initializeRoles = asyncHandler(async (req, res) => {
  const { clinicId } = req.body;
  
  // Validate user has access to this clinic
  if (req.user.clinicId.toString() !== clinicId && req.user.role !== 'Admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to initialize roles for this clinic'
    });
  }
  
  // Check if roles already exist for this clinic
  const existingRoles = await Role.countDocuments({ clinicId });
  if (existingRoles > 0) {
    return res.status(400).json({
      success: false,
      message: 'Roles already initialized for this clinic'
    });
  }
  
  // Get default roles
  const defaultRoles = Role.getDefaultRoles(clinicId);
  
  // Create default roles
  await Role.insertMany(defaultRoles);
  
  res.status(201).json({
    success: true,
    message: 'Default roles initialized successfully',
    count: defaultRoles.length
  });
});

export default {
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  getPermissions,
  assignRole,
  initializeRoles
};
