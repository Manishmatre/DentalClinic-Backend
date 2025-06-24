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
      joinedDate,
      joiningDate, // Added new field
      dateOfBirth, // Added new field
      gender      // Added new field
    } = req.body;
    
    console.log('Received new fields for staff creation:', {
      dateOfBirth,
      gender,
      joiningDate
    });

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
      // Add new fields
      joiningDate: joiningDate || joinedDate, // Use joiningDate if provided, otherwise use joinedDate
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      clinic: clinicId,
      // Important: Use the SAME hashed password we created earlier
      password: hashedPassword,
      userId: savedUser._id, // Link to the User record
      // Add profile image if provided
      profileImage: req.body.profileImage ? {
        url: req.body.profileImage.url || '',
        publicId: req.body.profileImage.publicId || ''
      } : { url: '', publicId: '' }
    });
    
    console.log('Creating Staff record with new fields:', {
      dateOfBirth: staff.dateOfBirth,
      gender: staff.gender,
      joiningDate: staff.joiningDate,
      profileImage: staff.profileImage
    });
    
    console.log('Raw profile image data from request:', req.body.profileImage);

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
    console.log('Starting staff update process...');
    // Extract only the essential fields from the request body
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
      joinedDate,
      joiningDate, // Added new field
      dateOfBirth, // Added new field
      gender,      // Added new field
      profileImage,
      password,
      updateUserPassword,
      userRole: userRoleFromBody
    } = req.body;
    
    console.log('Received new fields:', {
      dateOfBirth,
      gender,
      joiningDate
    });
    
    console.log('Received profile image data:', profileImage);
    
    const staffId = req.params.id;
    
    console.log(`Updating staff member ${staffId}`);
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Has password update:', !!password);
    
    // Get the clinic ID from the user object
    const clinicId = req.user.clinicId;
    console.log(`User clinic ID: ${clinicId}`);

    // Find the staff member by ID
    const staff = await Staff.findById(staffId);
    if (!staff) {
      console.log(`Staff with ID ${staffId} not found`);
      return res.status(404).json({ message: 'Staff member not found' });
    }
    
    console.log(`Staff clinic ID: ${staff.clinic}`);
    
    // Check if the staff member belongs to the user's clinic
    // Convert both to strings for proper comparison
    const userClinicIdStr = req.user.clinicId ? req.user.clinicId.toString() : '';
    const staffClinicIdStr = staff.clinic ? staff.clinic.toString() : '';
    
    console.log(`Comparing clinic IDs: User clinic=${userClinicIdStr}, Staff clinic=${staffClinicIdStr}`);
    
    // Determine if the user is an admin (either from token or request body)
    const isAdmin = req.user.role === 'Admin' || userRoleFromBody === 'Admin';
    console.log(`Is user an admin? ${isAdmin}`);
    
    // Allow update if clinic IDs match OR if the user is an admin
    if (userClinicIdStr !== staffClinicIdStr && !isAdmin) {
      console.log(`Authorization failed: Clinic IDs don't match and user is not an Admin`);
      return res.status(403).json({ 
        message: 'Not authorized to update this staff member',
        details: {
          userClinic: userClinicIdStr,
          staffClinic: staffClinicIdStr,
          userRole: req.user.role,
          userRoleFromBody: userRoleFromBody
        }
      });
    }
    
    console.log(`Authorization passed: User can update staff member`);
    
    // Check if email is being changed and if it's already in use
    if (email && email !== staff.email) {
      const existingStaff = await Staff.findOne({ email, clinic: req.user.clinicId, _id: { $ne: staffId } });
      if (existingStaff) {
        return res.status(400).json({ message: 'Email already in use by another staff member' });
      }
      
      // Also check User collection for email uniqueness
      const existingUser = await User.findOne({ email, _id: { $ne: staff.userId } });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use by another user' });
      }
    }

    // Handle password update if provided
    if (password && password.trim() !== '') {
      console.log('Updating password for staff member');
      // Hash the new password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      staff.password = hashedPassword;
      
      // Update the User record's password as well if requested
      if (updateUserPassword && staff.userId) {
        console.log('Also updating password in User record');
        const user = await User.findById(staff.userId);
        if (user) {
          user.password = hashedPassword;
          // Set a flag to prevent the pre-save hook from hashing the password again
          user.$skipPasswordHashing = true;
          await user.save();
          console.log(`Updated password for User record with ID: ${user._id}`);
        } else {
          console.warn(`Could not find User record with ID: ${staff.userId} for password update`);
        }
      }
    }

    // Create a safe update object with only the fields we want to update
    const updateData = {};
    
    // Update basic fields if provided
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (specialization !== undefined) updateData.specialization = specialization;
    if (department !== undefined) updateData.department = department;
    if (status) updateData.status = status;
    if (phone !== undefined) updateData.phone = phone;
    if (idNumber !== undefined) updateData.idNumber = idNumber;
    
    // Handle new fields
    if (dateOfBirth !== undefined) {
      console.log('Saving dateOfBirth:', dateOfBirth);
      updateData.dateOfBirth = dateOfBirth;
    }
    
    if (gender !== undefined) {
      console.log('Saving gender:', gender);
      updateData.gender = gender;
    }
    
    if (joiningDate !== undefined) {
      console.log('Saving joiningDate:', joiningDate);
      updateData.joiningDate = joiningDate;
    }
    
    // Handle address - ensure it's a string
    if (address !== undefined) {
      if (typeof address === 'object') {
        // Convert object to string
        updateData.address = JSON.stringify(address);
      } else {
        updateData.address = address;
      }
    }
    
    // Handle emergency contact - ensure it's a string
    if (emergencyContact !== undefined) {
      if (typeof emergencyContact === 'object') {
        // Convert object to string
        updateData.emergencyContact = JSON.stringify(emergencyContact);
      } else {
        updateData.emergencyContact = emergencyContact;
      }
    }
    
    // Handle array fields
    if (education !== undefined) {
      // Ensure education is an array
      if (typeof education === 'string') {
        try {
          updateData.education = JSON.parse(education);
        } catch (e) {
          updateData.education = [];
        }
      } else if (Array.isArray(education)) {
        updateData.education = education;
      } else {
        updateData.education = [];
      }
    }
    
    if (certifications !== undefined) {
      // Ensure certifications is an array
      if (typeof certifications === 'string') {
        try {
          updateData.certifications = JSON.parse(certifications);
        } catch (e) {
          updateData.certifications = [];
        }
      } else if (Array.isArray(certifications)) {
        updateData.certifications = certifications;
      } else {
        updateData.certifications = [];
      }
    }
    
    if (workExperience !== undefined) {
      // Ensure workExperience is an array
      if (typeof workExperience === 'string') {
        try {
          updateData.workExperience = JSON.parse(workExperience);
        } catch (e) {
          updateData.workExperience = [];
        }
      } else if (Array.isArray(workExperience)) {
        updateData.workExperience = workExperience;
      } else {
        updateData.workExperience = [];
      }
    }
    
    if (joinedDate !== undefined) {
      updateData.joinedDate = joinedDate;
    }
    
    // Update profile image if provided
    if (profileImage) {
      console.log('Processing profile image data:', profileImage);
      // Ensure the profileImage object has the required structure
      updateData.profileImage = {
        url: profileImage.url || '',
        publicId: profileImage.publicId || ''
      };
      console.log('Profile image data being saved:', updateData.profileImage);
    }
    
    // If password was updated, add it to the update data
    if (password && password.trim() !== '') {
      updateData.password = staff.password; // Use the already hashed password
    }
    
    console.log('Update data prepared:', Object.keys(updateData));
    
    // Apply the updates to the staff object
    Object.assign(staff, updateData);

    try {
      // Save Staff record
      const updatedStaff = await staff.save();
      console.log(`Updated Staff record with ID: ${updatedStaff._id}`);
      
      // Also update the corresponding User record if it exists (for fields other than password)
      if (staff.userId) {
        const user = await User.findById(staff.userId);
        if (user) {
          // Update User fields that should be in sync with Staff
          user.name = name || user.name;
          user.email = email || user.email;
          await user.save();
          console.log(`Updated User record with ID: ${user._id}`);
        } else {
          console.warn(`Could not find User record with ID: ${staff.userId} for update`);
        }
      }
      
      return res.status(200).json({
        success: true,
        message: 'Staff updated successfully',
        data: updatedStaff
      });
    } catch (saveError) {
      console.error('Error saving staff record:', saveError);
      
      // Handle validation errors
      if (saveError.name === 'ValidationError') {
        const validationErrors = Object.values(saveError.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Validation Error',
          errors: validationErrors
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Error saving staff record',
        error: saveError.message
      });
    }
  } catch (error) {
    console.error('Error updating staff:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors
      });
    }
    
    // Handle cast errors (invalid ObjectId)
    if (error.name === 'CastError') {
      console.error('Cast error details:', {
        path: error.path,
        value: error.value,
        kind: error.kind
      });
      return res.status(400).json({ 
        success: false,
        message: `Invalid data format for field '${error.path}'`,
        error: error.message,
        details: {
          field: error.path,
          value: error.value,
          expectedType: error.kind
        }
      });
    }
    
    res.status(500).json({ 
      message: 'Error updating staff member', 
      error: error.message,
      errorType: error.name
    });
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
    const clinicId = req.user.clinicId;
    console.log('Getting staff stats for clinic:', clinicId);
    
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
    
    // Get recently joined staff (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentlyJoined = await Staff.find({
      clinic: clinicId,
      createdAt: { $gte: thirtyDaysAgo }
    })
    .select('_id name email role department joinedDate profileImage')
    .sort({ createdAt: -1 })
    .limit(5);
    
    // Convert role stats to object format expected by frontend
    const roleDistribution = {};
    roleStats.forEach(role => {
      if (role._id) {
        roleDistribution[role._id] = role.count;
      }
    });
    
    // Convert department stats to object format expected by frontend
    const departmentDistribution = {};
    departmentStats.forEach(dept => {
      if (dept._id) {
        departmentDistribution[dept._id] = dept.count;
      }
    });
    
    // Get counts by status
    const totalActive = statusStats.find(s => s._id === 'Active')?.count || 0;
    const totalInactive = statusStats.find(s => s._id === 'Inactive')?.count || 0;
    const totalOnLeave = statusStats.find(s => s._id === 'On Leave')?.count || 0;
    
    // Generate trend data (mock for now, can be replaced with real data later)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    const trendLabels = [];
    for (let i = 0; i < 6; i++) {
      const monthIndex = (currentMonth - i + 12) % 12;
      trendLabels.unshift(months[monthIndex]);
    }
    
    // For now, generate some simple trend data
    const totalStaff = await Staff.countDocuments({ clinic: clinicId });
    const trendData = [Math.max(0, totalStaff - 5), Math.max(0, totalStaff - 4), 
                      Math.max(0, totalStaff - 3), Math.max(0, totalStaff - 2), 
                      Math.max(0, totalStaff - 1), totalStaff];
    
    // Format response to match frontend expectations
    const response = {
      totalActive,
      totalInactive,
      totalOnLeave,
      roleDistribution,
      departmentDistribution,
      recentlyJoined,
      trendLabels,
      trendData
    };
    
    console.log('Sending staff stats:', response);
    res.json(response);
  } catch (error) {
    console.error('Error fetching staff statistics:', error);
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
}

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