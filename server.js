import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import clinicRoutes from './routes/clinicRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import billingRoutes from './routes/billingRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import dentalInventoryRoutes from './routes/dentalInventoryRoutes.js';
import dentalProcedureRoutes from './routes/dentalProcedureRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import patientRoutes from './routes/patients.js';
import staffRoutes from './routes/staffRoutes.js';
import branchRoutes from './routes/branchRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import patientRequestRoutes from './routes/patientRequestRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';

const app = express();

// Middleware
app.use(cors({
  origin: ['https://dentalos.netlify.app', process.env.FRONTEND_URL || 'https://dentalos.netlify.app'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctors', doctorRoutes); // Add doctor routes
app.use('/api', documentRoutes); // Add document routes
app.use('/api/invoices', invoiceRoutes); // Add invoice routes
app.use('/api/billing', billingRoutes); // Add billing routes
app.use('/api/inventory', inventoryRoutes); // Add inventory routes
app.use('/api/inventory/dental', dentalInventoryRoutes); // Add dental inventory routes
app.use('/api/dental/procedures', dentalProcedureRoutes); // Add dental procedure routes
app.use('/api/admin', adminRoutes); // Add admin routes
app.use('/api/patients', patientRoutes); // Add patient routes
app.use('/api/staff', staffRoutes); // Add staff routes
app.use('/api/branches', branchRoutes); // Add branch routes
app.use('/api/services', serviceRoutes); // Add service routes
app.use('/api/upload', uploadRoutes); // Add upload routes
app.use('/api/subscriptions', subscriptionRoutes); // Add subscription routes
app.use('/api/payments', paymentRoutes); // Add payment routes
app.use('/api/patient-requests', patientRequestRoutes); // Add patient request routes

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4 // Force IPv4
})
  .then(() => console.log('MongoDB connected Successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
