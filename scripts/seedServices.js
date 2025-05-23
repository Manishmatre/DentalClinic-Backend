/**
 * Script to seed default services into the database
 * Run this script with: node scripts/seedServices.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import colors from 'colors';
import defaultServices from '../data/defaultServices.js';
import Service from '../models/Service.js';
import connectDB from '../config/db.js';

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

// Function to seed services
const seedServices = async (clinicId) => {
  try {
    if (!clinicId) {
      console.error('Clinic ID is required'.red.bold);
      process.exit(1);
    }

    // Clear existing services for this clinic
    await Service.deleteMany({ clinicId });
    console.log('Existing services cleared'.yellow);

    // Add clinic ID to each service
    const servicesWithClinicId = defaultServices.map(service => ({
      ...service,
      clinicId
    }));

    // Insert services
    await Service.insertMany(servicesWithClinicId);

    console.log(`${servicesWithClinicId.length} services seeded successfully`.green.bold);
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`.red.bold);
    process.exit(1);
  }
};

// Get clinic ID from command line arguments
const args = process.argv.slice(2);
const clinicId = args[0];

if (!clinicId) {
  console.log('Usage: node seedServices.js <clinicId>'.yellow);
  process.exit(1);
}

// Run the seed function
seedServices(clinicId);
