import User from '../models/User.js';
import bcrypt from 'bcryptjs';

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const updateData = { ...req.body };
    
    // Special handling for password change
    if (updateData.newPassword) {
      // Verify current password before allowing change
      if (!updateData.currentPassword) {
        return res.status(400).json({ 
          message: 'Current password is required to set a new password' 
        });
      }

      // Get user with password
      const user = await User.findById(userId).select('+password');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if current password is valid
      const isMatch = await user.comparePassword(updateData.currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updateData.newPassword, salt);
      updateData.passwordChangedAt = new Date();
      
      // Remove the temporary fields
      delete updateData.currentPassword;
      delete updateData.newPassword;
    }
    
    // Prevent changing critical fields
    delete updateData.role;
    delete updateData.isEmailVerified;
    delete updateData.clinicId;
    delete updateData.email; // Email change should be a separate process with verification

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: 'Error updating profile', error: err.message });
  }
};

export default updateProfile;
