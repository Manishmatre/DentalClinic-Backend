import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const emailTemplates = {
  verification: (verificationUrl) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div className="container">
        <h1>Welcome to Dental Clinic Management</h1>
        <p>Thank you for registering! Please verify your email address to continue.</p>
        <a href="${verificationUrl}" className="button">Verify Email</a>
        <p>If you did not create an account, please ignore this email.</p>
        <div className="footer">
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `,
  
  passwordReset: (resetUrl) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
        .warning { color: #991B1B; margin-top: 20px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div className="container">
        <h1>Password Reset Request</h1>
        <p>You requested to reset your password. Click the button below to set a new password:</p>
        <a href="${resetUrl}" className="button">Reset Password</a>
        <p className="warning">If you did not request this password reset, please ignore this email and ensure your account is secure.</p>
        <p>This link will expire in 1 hour for security reasons.</p>
        <div className="footer">
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  appointmentConfirmation: (details) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .details { background: #F3F4F6; padding: 20px; border-radius: 4px; margin: 20px 0; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div className="container">
        <h1>Appointment Confirmation</h1>
        <p>Your appointment has been scheduled successfully.</p>
        <div className="details">
          <h2>Appointment Details:</h2>
          <ul>
            <li>Date: ${details.date}</li>
            <li>Time: ${details.time}</li>
            <li>Doctor: ${details.dentist}</li>
            <li>Service: ${details.service}</li>
          </ul>
        </div>
        <p><strong>Note:</strong> If you need to reschedule or cancel, please contact us at least 24 hours before your appointment.</p>
        <div className="footer">
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `,
  
  appointmentReminder: (details) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { color: #4F46E5; }
        .details { margin: 20px 0; padding: 15px; background-color: #f8f8f8; border-radius: 5px; }
        .highlight { font-weight: bold; color: #059669; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="header">Appointment Reminder</h1>
        <p>This is a friendly reminder about your upcoming appointment.</p>
        
        <div class="details">
          <p><strong>Doctor:</strong> ${details.doctorName}</p>
          <p><strong>Date:</strong> <span class="highlight">${new Date(details.startTime).toLocaleDateString()}</span></p>
          <p><strong>Time:</strong> <span class="highlight">${new Date(details.startTime).toLocaleTimeString()} - ${new Date(details.endTime).toLocaleTimeString()}</span></p>
          <p><strong>Service:</strong> ${details.serviceType}</p>
          ${details.notes ? `<p><strong>Notes:</strong> ${details.notes}</p>` : ''}
        </div>
        
        <p>Please arrive 10-15 minutes before your scheduled appointment time. If you need to reschedule or cancel, please contact us at least 24 hours in advance.</p>
        
        <div class="footer">
          <p>This is an automated message, please do not reply to this email.</p>
          <p>If you have any questions, please contact the clinic directly.</p>
        </div>
      </div>
    </body>
    </html>
  `,
  
  appointmentCancellation: (details) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { color: #991B1B; }
        .details { margin: 20px 0; padding: 15px; background-color: #f8f8f8; border-radius: 5px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="header">Appointment Cancellation</h1>
        <p>Your appointment has been cancelled.</p>
        
        <div class="details">
          <p><strong>Doctor:</strong> ${details.doctorName}</p>
          <p><strong>Date:</strong> ${new Date(details.startTime).toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${new Date(details.startTime).toLocaleTimeString()} - ${new Date(details.endTime).toLocaleTimeString()}</p>
          <p><strong>Service:</strong> ${details.serviceType}</p>
          ${details.cancellationReason ? `<p><strong>Reason for cancellation:</strong> ${details.cancellationReason}</p>` : ''}
        </div>
        
        <p>If you would like to reschedule, please contact us or book a new appointment through our system.</p>
        
        <div class="footer">
          <p>This is an automated message, please do not reply to this email.</p>
          <p>If you have any questions, please contact the clinic directly.</p>
        </div>
      </div>
    </body>
    </html>
  `,
  
  appointmentReschedule: (details) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { color: #4F46E5; }
        .details { margin: 20px 0; padding: 15px; background-color: #f8f8f8; border-radius: 5px; }
        .old-time { text-decoration: line-through; color: #991B1B; }
        .new-time { font-weight: bold; color: #059669; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="header">Appointment Rescheduled</h1>
        <p>Your appointment has been rescheduled to a new time.</p>
        
        <div class="details">
          <p><strong>Doctor:</strong> ${details.doctorName}</p>
          <p><strong>Service:</strong> ${details.serviceType}</p>
          
          <p><strong>Previous Time:</strong> <span class="old-time">${new Date(details.oldStartTime).toLocaleDateString()} at ${new Date(details.oldStartTime).toLocaleTimeString()}</span></p>
          
          <p><strong>New Time:</strong> <span class="new-time">${new Date(details.startTime).toLocaleDateString()} at ${new Date(details.startTime).toLocaleTimeString()} - ${new Date(details.endTime).toLocaleTimeString()}</span></p>
          
          ${details.reason ? `<p><strong>Reason for rescheduling:</strong> ${details.reason}</p>` : ''}
        </div>
        
        <p>If this new time doesn't work for you, please contact us as soon as possible to arrange a different time.</p>
        
        <div class="footer">
          <p>This is an automated message, please do not reply to this email.</p>
          <p>If you have any questions, please contact the clinic directly.</p>
        </div>
      </div>
    </body>
    </html>
  `
};

export const sendVerificationEmail = async (email, verificationToken, userId) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&id=${userId}`;
  
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Dental Clinic'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - Dental Clinic Management',
      html: emailTemplates.verification(verificationUrl)
    });
    
    console.log('Verification email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

export const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Dental Clinic'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset - Dental Clinic Management',
      html: emailTemplates.passwordReset(resetUrl)
    });

    console.log('Password reset email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

export const sendAppointmentConfirmation = async (email, appointmentDetails) => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Dental Clinic'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Appointment Confirmation - Dental Clinic Management',
      html: emailTemplates.appointmentConfirmation(appointmentDetails)
    });

    console.log('Appointment confirmation email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending appointment confirmation:', error);
    throw new Error('Failed to send appointment confirmation email');
  }
};

export const sendAppointmentReminder = async (email, appointmentDetails) => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Dental Clinic'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Appointment Reminder - Dental Clinic Management',
      html: emailTemplates.appointmentReminder(appointmentDetails)
    });

    console.log('Appointment reminder email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending appointment reminder:', error);
    throw new Error('Failed to send appointment reminder email');
  }
};

export const sendAppointmentCancellation = async (email, appointmentDetails) => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Dental Clinic'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Appointment Cancellation - Dental Clinic Management',
      html: emailTemplates.appointmentCancellation(appointmentDetails)
    });

    console.log('Appointment cancellation email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending appointment cancellation:', error);
    throw new Error('Failed to send appointment cancellation email');
  }
};

export const sendAppointmentReschedule = async (email, appointmentDetails) => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Dental Clinic'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Appointment Rescheduled - Dental Clinic Management',
      html: emailTemplates.appointmentReschedule(appointmentDetails)
    });

    console.log('Appointment reschedule email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending appointment reschedule email:', error);
    throw new Error('Failed to send appointment reschedule email');
  }
};