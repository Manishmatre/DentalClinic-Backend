import mongoose from 'mongoose';

const DentistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    required: true
  },
  specialization: {
    type: String,
    required: true
  },
  experience: {
    type: Number,
    required: true
  },
  availability: {
    type: String,
    required: true
  },
  bio: {
    type: String
  },
  rating: {
    type: Number,
    default: 0
  },
  date: {
    type: Date,
    default: Date.now
  }
});

const Dentist = mongoose.model('Dentist', DentistSchema);

export default Dentist; 