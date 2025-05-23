import Staff from '../models/Staff.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import { generateToken } from '../utils/authUtils.js';
import mongoose from 'mongoose';

// Get all staff members for a clinic with filtering and pagination
export const getStaff = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      role, 
      department, 
      status, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      dateRange,
      timestamp // Ignore this parameter, it's just for cache busting
    } = req.query;
    
    console.log('Getting staff for clinic:', req.user.clinicId);
    console.log('Query parameters:', req.query);
    
    // Build query
    const query = { clinic: req.user.clinicId };
    
    // Log the current number of staff in the database for this clinic
    const totalStaffCount = await Staff.countDocuments({ clinic: req.user.clinicId });
    console.log(`Total staff count for clinic ${req.user.clinicId}: ${totalStaffCount}`);
    
    // Log all staff emails for debugging
    const allStaffEmails = await Staff.find({ clinic: req.user.clinicId }).select('email role');
    console.log('All staff emails in database:', allStaffEmails.map(s => ({ email: s.email, role: s.role })));
    
    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add role filter
    if (role) {
      query.role = role;
    }
    
    // Add department filter
    if (department) {
      query.department = department;
    }
    
    // Add status filter
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Add date range filter
    if (dateRange && dateRange !== 'all') {
      const today = new Date();
      let startDate;
      
      switch (dateRange) {
        case 'today':
          startDate = new Date(today.setHours(0, 0, 0, 0));
          query.createdAt = { $gte: startDate };
          break;
        case 'week':
          startDate = new Date(today.setDate(today.getDate() - 7));
          query.createdAt = { $gte: startDate };
          break;
        case 'month':
          startDate = new Date(today.setMonth(today.getMonth() - 1));
          query.createdAt = { $gte: startDate };
          break;
        case 'year':
          startDate = new Date(today.setFullYear(today.getFullYear() - 1));
          query.createdAt = { $gte: startDate };
          break;
      }
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Determine sort direction
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Execute query with pagination
    const staff = await Staff.find(query)
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Staff.countDocuments(query);
    
    // Calculate total pages
    const pages = Math.ceil(total / parseInt(limit));
    
    res.json({
      data: staff,
      pagination: {
        total,
        pages,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching staff members', error: error.message });
  }
};

// Get a single staff member by ID
export const getStaffById = async (req, res) => {
  try {
    const staffId = req.params.id;
    
    const staff = await Staff.findOne({ 
      _id: staffId, 
      clinic: req.user.clinicId 
    }).select('-password');
    
    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }
    
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching staff member', error: error.message });
  }
};

// Create a new staff member
export const createStaff = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      role, 
      specialization, 
      department, 
      status, 
      phone, 
      address, 
      idNumber, 
      emergencyContact, 
      education, 
      certifications, 
      workExperience, 
      joinedDate 
    } = req.body;

    // Get the clinic ID from the user object
    const clinicId = req.user.clinicId;
    
    // Check if staff with email already exists
    const existingStaff = await Staff.findOne({ email, clinic: clinicId });
    if (existingStaff) {
      return res.status(400).json({ message: 'Staff member with this email already exists' });
    }
    
    // Check if user with email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Use a fixed password for easier testing
    const tempPassword = '11223344'; // Fixed password for all staff during testing
    console.log(`Using fixed password for ${email}: ${tempPassword}`);
    
    // We will NOT hash the password here - we'll let the User model's pre-save hook handle it
    // This ensures consistent password hashing across the application
    
    console.log(`Creating staff member with email: ${email}, role: ${role}, clinic: ${clinicId}`);
    
    // First, hash the password manually so we can use the exact same hash for both models
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(tempPassword, saltRounds);
    console.log(`Manually hashed password for consistent storage`);
    
    // Create a new User record first with all required fields
    // IMPORTANT: We're using the pre-hashed password to ensure consistency
    const newUser = new User({
      name,
      email,
      password: hashedPassword, // Use the manually hashed password
      role,
      clinicId,
      isApproved: true,
      approvalStatus: 'approved',
      userType: role.toLowerCase(),
      isEmailVerified: true, // Set email as verified for internally added staff
      phone: phone || '',
      address: address || '',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Set a flag to prevent the pre-save hook from hashing the password again
    newUser.$skipPasswordHashing = true;
    
    // Save the User record
    const savedUser = await newUser.save();
    console.log(`Created User record with ID: ${savedUser._id}`);
    console.log('User record details:', {
      id: savedUser._id,
      name: savedUser.name,
      email: savedUser.email,
      role: savedUser.role,
      isApproved: savedUser.isApproved,
      isEmailVerified: savedUser.isEmailVerified
    });
    
    // Verify the user can be found by email (important for login)
    const verifyUser = await User.findOne({ email });
    if (verifyUser) {
      console.log(`Verified user can be found by email: ${email}`);
      
      // Test password verification to ensure it will work during login
      const isPasswordValid = await bcrypt.compare(tempPassword, hashedPassword);
      console.log(`Password verification test: ${isPasswordValid ? 'PASSED' : 'FAILED'}`);
    } else {
      console.error(`WARNING: User with email ${email} cannot be found after creation!`);
    }

    // Create the Staff record with the same password hash
    const staff = new Staff({
      name,
      email,
      role,
      specialization,
      department,
      status,
      phone,
      address,
      idNumber,
      emergencyContact,
      education,
      certifications,
      workExperience,
      joinedDate,
      clinic: clinicId,
      // Important: Use the SAME hashed password we created earlier
      password: hashedPassword,
      userId: savedUser._id // Link to the User record
    });

    // Save the Staff record
    const savedStaff = await staff.save();
    console.log(`Created Staff record with ID: ${savedStaff._id}`);

    // Send email with temporary password (implement email service later)
    // For now, we'll just return the temp password in response
    res.status(201).json({
      message: 'Staff member created successfully',
      staff: {
        ...savedStaff.toObject(),
        password: undefined,
        tempPassword
      },
      user: {
        id: savedUser._id,
        email: savedUser.email,
        role: savedUser.role
      }
    });
  } catch (error) {
    console.error('Error creating staff member:', error);
    res.status(500).json({ message: 'Error creating staff member', error: error.message });
  }
};

// Update a staff member
export const updateStaff = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      role, 
      specialization, 
      department, 
      status, 
      phone, 
      address, 
      idNumber, 
      emergencyContact, 
      education, 
      certifications, 
      workExperience, 
      joinedDate 
    } = req.body;
    const staffId = req.params.id;
    
    // Get the clinic ID from the user object
    const clinicId = req.user.clinicId;

    const staff = await Staff.findOne({ _id: staffId, clinic: clinicId });
    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    // Check if email is being changed and if it's already in use
    if (email !== staff.email) {
      const existingStaff = await Staff.findOne({ email, clinic: req.user.clinicId });
      if (existingStaff) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      
      // Also check User collection for email uniqueness
      const existingUser = await User.findOne({ email, _id: { $ne: staff.userId } });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use by another user' });
      }
    }

    // Update all fields in Staff collection
    staff.name = name || staff.name;
    staff.email = email || staff.email;
    staff.role = role || staff.role;
    staff.specialization = specialization || staff.specialization;
    staff.department = department || staff.department;
    staff.status = status || staff.status;
    staff.phone = phone || staff.phone;
    staff.address = address || staff.address;
    staff.idNumber = idNumber || staff.idNumber;
    staff.emergencyContact = emergencyContact || staff.emergencyContact;
    staff.education = education || staff.education;
    
    // Handle arrays properly
    if (certifications) staff.certifications = certifications;
    if (workExperience) staff.workExperience = workExperience;
    
    // Handle date
    if (joinedDate) staff.joinedDate = joinedDate;

    // Save Staff record
    const updatedStaff = await staff.save();
    
    // Also update the corresponding User record if it exists
    if (staff.userId) {
      const user = await User.findById(staff.userId);
      if (user) {
        // Update User fields that should be in sync with Staff
        user.name = name || user.name;
        user.email = email || user.email;
        user.role = role || user.role;
        user.phone = phone || user.phone;
        user.address = address || user.address;
        user.userType = (role || user.role).toLowerCase();
        
        // Save User record
        await user.save();
        console.log(`Updated User record with ID: ${user._id} to match Staff record`);
      } else {
        console.warn(`Could not find User record with ID: ${staff.userId} for Staff member ${staffId}`);
      }
    } else {
      console.warn(`Staff member ${staffId} does not have a linked userId`);
    }

    res.json({
      message: 'Staff member updated successfully',
      staff: {
        ...updatedStaff.toObject(),
        password: undefined
      }
    });
  } catch (error) {
    console.error('Error updating staff member:', error);
    res.status(500).json({ message: 'Error updating staff member', error: error.message });
  }
};

// Delete a staff member
export const deleteStaff = async (req, res) => {
  try {
    const staffId = req.params.id;
    const staff = await Staff.findOne({ _id: staffId, clinic: req.user.clinicId });
    
    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    // Also delete the corresponding User record if it exists
    if (staff.userId) {
      await User.deleteOne({ _id: staff.userId });
      console.log(`Deleted User record with ID: ${staff.userId}`);
    }

    await Staff.deleteOne({ _id: staffId });
    res.json({ message: 'Staff member deleted successfully' });
  } catch (error) {
    console.error('Error deleting staff member:', error);
    res.status(500).json({ message: 'Error deleting staff member', error: error.message });
  }
};

// Update staff status
export const updateStaffStatus = async (req, res) => {
  try {
    const staffId = req.params.id;
    const { status } = req.body;
    
    if (!['Active', 'Inactive', 'On Leave'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    
    // Get the clinic ID from the user object
    const clinicId = req.user.clinicId;
    
    const staff = await Staff.findOne({ _id: staffId, clinic: clinicId });
    
    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }
    
    staff.status = status;
    await staff.save();
    
    res.json({
      message: 'Staff status updated successfully',
      staff: {
        ...staff.toObject(),
        password: undefined
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating staff status', error: error.message });
  }
};

// Reset staff password
export const resetPassword = async (req, res) => {
  try {
    const staffId = req.params.id;
    
    // Get the clinic ID from the user object
    const clinicId = req.user.clinicId;
    
    const staff = await Staff.findOne({ _id: staffId, clinic: clinicId });
    
    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }
    
    // Generate a simple, predictable password for easier testing
    const tempPassword = `Pass1234`;
    console.log(`Resetting password for staff ${staff.email} to: ${tempPassword}`);
    
    // Find the associated User record
    let userRecord = null;
    if (staff.userId) {
      userRecord = await User.findById(staff.userId);
      console.log(`Found associated User record with ID: ${staff.userId}`);
    } else {
      // Try to find by email if userId is not set
      userRecord = await User.findOne({ email: staff.email });
      if (userRecord) {
        console.log(`Found User record by email: ${staff.email}`);
        // Update the staff record with the userId for future reference
        staff.userId = userRecord._id;
      }
    }
    
    // Hash the password for the Staff record
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    staff.password = hashedPassword;
    await staff.save();
    console.log(`Updated Staff record password`);
    
    // Update the User record password if found
    if (userRecord) {
      userRecord.password = tempPassword; // Plain text - will be hashed by User model
      await userRecord.save();
      console.log(`Updated User record password`);
    } else {
      console.warn(`No User record found for staff ${staff.email} - only updated Staff record`);
    }
    
    res.json({
      message: 'Password reset successfully',
      tempPassword,
      userUpdated: !!userRecord
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Error resetting password', error: error.message });
  }
};

// Get staff statistics
export const getStaffStats = async (req, res) => {
  try {
    // ... (rest of the code remains the same)
    const clinicId = req.user.clinicId;
    
    // Get total count by role
    const roleStats = await Staff.aggregate([
      { $match: { clinic: mongoose.Types.ObjectId(clinicId) } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get total count by department
    const departmentStats = await Staff.aggregate([
      { $match: { clinic: mongoose.Types.ObjectId(clinicId) } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get total count by status
    const statusStats = await Staff.aggregate([
      { $match: { clinic: mongoose.Types.ObjectId(clinicId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get total staff count
    const totalStaff = await Staff.countDocuments({ clinic: clinicId });
    
    // Get new staff in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newStaff = await Staff.countDocuments({
      clinic: clinicId,
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    res.json({
      totalStaff,
      newStaff,
      byRole: roleStats,
      byDepartment: departmentStats,
      byStatus: statusStats
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching staff statistics', error: error.message });
  }
};

// Special endpoint to fix a user's password - this is for testing/debugging only
export const fixUserPassword = async (req, res) => {
  try {
    const { email } = req.params;
    
    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Find the staff by email
    const staff = await Staff.findOne({ email });
    
    // Set a fixed password for easier testing
    const fixedPassword = 'Pass1234';
    console.log(`Setting password for ${email} to: ${fixedPassword}`);
    
    // Update the User record
    user.password = fixedPassword; // Will be hashed by User model pre-save hook
    await user.save();
    console.log(`Updated User record password for ${email}`);
    
    // Update the Staff record if it exists
    if (staff) {
      // We need to hash the password for the Staff record
      const hashedPassword = await bcrypt.hash(fixedPassword, 10);
      staff.password = hashedPassword;
      await staff.save();
      console.log(`Updated Staff record password for ${email}`);
    }
    
    res.json({
      success: true,
      message: `Password for ${email} has been reset to ${fixedPassword}`,
      userUpdated: true,
      staffUpdated: !!staff
    });
  } catch (error) {
    console.error('Error fixing user password:', error);
    res.status(500).json({ message: 'Error fixing user password', error: error.message });
  }
};

// Staff login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const staff = await Staff.findOne({ email });
    if (!staff) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, staff.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (staff.status !== 'Active') {
      return res.status(401).json({ message: 'Account is inactive' });
    }

    const token = generateToken(staff);

    res.json({
      token,
      staff: {
        ...staff.toObject(),
        password: undefined
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
}; 