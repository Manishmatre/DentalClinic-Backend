/**
 * Default medical service types for the Clinic Management System
 * This file provides a comprehensive list of common medical services
 * that can be used as default options when setting up a new clinic
 */

const defaultServices = [
  // General Medicine
  {
    name: "General Consultation",
    category: "General Medicine",
    description: "Regular medical consultation for general health concerns",
    duration: 30, // in minutes
    defaultPrice: 100,
    status: "Active"
  },
  {
    name: "Comprehensive Health Check",
    category: "General Medicine",
    description: "Complete physical examination and health assessment",
    duration: 60,
    defaultPrice: 200,
    status: "Active"
  },
  {
    name: "Follow-up Consultation",
    category: "General Medicine",
    description: "Follow-up visit for existing conditions",
    duration: 15,
    defaultPrice: 50,
    status: "Active"
  },
  
  // Specialized Consultations
  {
    name: "Cardiology Consultation",
    category: "Specialized Care",
    description: "Heart and cardiovascular system examination",
    duration: 45,
    defaultPrice: 250,
    status: "Active"
  },
  {
    name: "Dermatology Consultation",
    category: "Specialized Care",
    description: "Skin, hair, and nail examination",
    duration: 30,
    defaultPrice: 200,
    status: "Active"
  },
  {
    name: "Orthopedic Consultation",
    category: "Specialized Care",
    description: "Bone and joint examination",
    duration: 45,
    defaultPrice: 250,
    status: "Active"
  },
  {
    name: "Neurology Consultation",
    category: "Specialized Care",
    description: "Nervous system examination",
    duration: 45,
    defaultPrice: 250,
    status: "Active"
  },
  {
    name: "Gynecology Consultation",
    category: "Women's Health",
    description: "Female reproductive system examination",
    duration: 45,
    defaultPrice: 200,
    status: "Active"
  },
  {
    name: "Pediatric Consultation",
    category: "Child Health",
    description: "Medical care for infants, children, and adolescents",
    duration: 30,
    defaultPrice: 150,
    status: "Active"
  },
  {
    name: "Psychiatry Consultation",
    category: "Mental Health",
    description: "Mental health assessment and treatment",
    duration: 60,
    defaultPrice: 300,
    status: "Active"
  },
  {
    name: "ENT Consultation",
    category: "Specialized Care",
    description: "Ear, nose, and throat examination",
    duration: 30,
    defaultPrice: 200,
    status: "Active"
  },
  {
    name: "Ophthalmology Consultation",
    category: "Specialized Care",
    description: "Eye examination and vision assessment",
    duration: 30,
    defaultPrice: 200,
    status: "Active"
  },
  
  // Diagnostic Services
  {
    name: "Blood Test",
    category: "Diagnostics",
    description: "Collection and analysis of blood samples",
    duration: 15,
    defaultPrice: 50,
    status: "Active"
  },
  {
    name: "X-Ray",
    category: "Diagnostics",
    description: "Radiographic imaging of body structures",
    duration: 20,
    defaultPrice: 100,
    status: "Active"
  },
  {
    name: "Ultrasound",
    category: "Diagnostics",
    description: "Sonographic imaging of internal organs",
    duration: 30,
    defaultPrice: 150,
    status: "Active"
  },
  {
    name: "ECG",
    category: "Diagnostics",
    description: "Electrocardiogram for heart activity monitoring",
    duration: 15,
    defaultPrice: 75,
    status: "Active"
  },
  {
    name: "MRI Scan",
    category: "Diagnostics",
    description: "Magnetic resonance imaging of body structures",
    duration: 60,
    defaultPrice: 500,
    status: "Active"
  },
  {
    name: "CT Scan",
    category: "Diagnostics",
    description: "Computed tomography imaging of body structures",
    duration: 30,
    defaultPrice: 350,
    status: "Active"
  },
  
  // Preventive Care
  {
    name: "Vaccination",
    category: "Preventive Care",
    description: "Administration of vaccines for disease prevention",
    duration: 15,
    defaultPrice: 50,
    status: "Active"
  },
  {
    name: "Annual Physical",
    category: "Preventive Care",
    description: "Yearly comprehensive health assessment",
    duration: 60,
    defaultPrice: 200,
    status: "Active"
  },
  {
    name: "Wellness Consultation",
    category: "Preventive Care",
    description: "Consultation focused on maintaining optimal health",
    duration: 45,
    defaultPrice: 150,
    status: "Active"
  },
  
  // Procedures
  {
    name: "Minor Surgery",
    category: "Procedures",
    description: "Small surgical procedures performed in-office",
    duration: 60,
    defaultPrice: 300,
    status: "Active"
  },
  {
    name: "Wound Care",
    category: "Procedures",
    description: "Cleaning, dressing, and treatment of wounds",
    duration: 30,
    defaultPrice: 100,
    status: "Active"
  },
  {
    name: "IV Therapy",
    category: "Procedures",
    description: "Intravenous administration of fluids or medications",
    duration: 60,
    defaultPrice: 200,
    status: "Active"
  },
  {
    name: "Allergy Testing",
    category: "Procedures",
    description: "Testing for allergic reactions to various substances",
    duration: 45,
    defaultPrice: 150,
    status: "Active"
  },
  
  // Therapy Services
  {
    name: "Physical Therapy Session",
    category: "Therapy",
    description: "Therapeutic exercises for physical rehabilitation",
    duration: 45,
    defaultPrice: 120,
    status: "Active"
  },
  {
    name: "Occupational Therapy",
    category: "Therapy",
    description: "Therapy to develop, recover, or maintain daily living skills",
    duration: 45,
    defaultPrice: 120,
    status: "Active"
  },
  {
    name: "Speech Therapy",
    category: "Therapy",
    description: "Therapy for speech and language disorders",
    duration: 45,
    defaultPrice: 120,
    status: "Active"
  },
  {
    name: "Psychotherapy Session",
    category: "Mental Health",
    description: "Therapeutic conversation for mental health treatment",
    duration: 50,
    defaultPrice: 150,
    status: "Active"
  },
  
  // Dental Services
  {
    name: "Dental Check-up",
    category: "Dental",
    description: "Routine dental examination and cleaning",
    duration: 30,
    defaultPrice: 100,
    status: "Active"
  },
  {
    name: "Dental Filling",
    category: "Dental",
    description: "Restoration of decayed teeth with filling material",
    duration: 45,
    defaultPrice: 150,
    status: "Active"
  },
  {
    name: "Root Canal",
    category: "Dental",
    description: "Treatment of infected dental pulp",
    duration: 90,
    defaultPrice: 500,
    status: "Active"
  },
  
  // Maternal & Child Health
  {
    name: "Prenatal Check-up",
    category: "Women's Health",
    description: "Regular monitoring of pregnancy progress",
    duration: 30,
    defaultPrice: 150,
    status: "Active"
  },
  {
    name: "Well-Baby Check-up",
    category: "Child Health",
    description: "Regular health assessment for infants and toddlers",
    duration: 30,
    defaultPrice: 100,
    status: "Active"
  },
  {
    name: "Immunization Visit",
    category: "Child Health",
    description: "Scheduled childhood vaccinations",
    duration: 20,
    defaultPrice: 75,
    status: "Active"
  }
];

export default defaultServices;
