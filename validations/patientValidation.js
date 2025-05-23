import Joi from 'joi';

// Validation logic for patient-related requests

export const createPatientSchema = Joi.object({
  clinicId: Joi.string().hex().length(24),
  name: Joi.string().required().min(2).max(100),
  email: Joi.string().email(),
  phone: Joi.string(),
  dateOfBirth: Joi.date().allow(null, ''),
  gender: Joi.string().valid('male', 'female', 'other').allow(null, ''),
  address: Joi.string().allow(null, ''),
  city: Joi.string().allow(null, ''),
  state: Joi.string().allow(null, ''),
  zipCode: Joi.string().allow(null, ''),
  country: Joi.string().allow(null, ''),
  bloodGroup: Joi.string().allow(null, ''),
  allergies: Joi.string().allow(null, ''),
  medicalHistory: Joi.string().allow(null, ''),
  emergencyContact: Joi.object({
    name: Joi.string().allow(null, ''),
    relationship: Joi.string().allow(null, ''),
    phone: Joi.string().allow(null, '')
  }).allow(null),
  insuranceInfo: Joi.object({
    provider: Joi.string().allow(null, ''),
    policyNumber: Joi.string().allow(null, ''),
    groupNumber: Joi.string().allow(null, '')
  }).allow(null),
  status: Joi.string().valid('active', 'inactive').default('active'),
  password: Joi.string().min(6).allow(null, ''), // Added password field
  patientId: Joi.string().allow(null, '')
});

export const updatePatientSchema = createPatientSchema.fork(
  ['name', 'email', 'phone', 'dateOfBirth', 'gender', 'address', 'emergencyContact'],
  (schema) => schema.optional()
);

export const medicalHistorySchema = Joi.object({
  medicalHistory: Joi.string().required(),
  allergies: Joi.array().items(Joi.string()),
  currentMedications: Joi.array().items(Joi.string()),
  pastSurgeries: Joi.array().items(Joi.string()),
  familyHistory: Joi.string(),
  notes: Joi.string()
});

export const treatmentSchema = Joi.object({
  diagnosis: Joi.string().required(),
  treatment: Joi.string().required(),
  prescription: Joi.array().items(Joi.object({
    medicine: Joi.string().required(),
    dosage: Joi.string().required(),
    frequency: Joi.string().required(),
    duration: Joi.string().required()
  })),
  notes: Joi.string(),
  followUpDate: Joi.date().greater('now')
});
