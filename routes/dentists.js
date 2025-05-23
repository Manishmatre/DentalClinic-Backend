import express from 'express';
import auth from '../middleware/auth.js';
import Dentist from '../models/Dentist.js';

const router = express.Router();

// @route   GET api/dentists
// @desc    Get all dentists
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const dentists = await Dentist.find().sort({ date: -1 });
    res.json(dentists);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST api/dentists
// @desc    Create a dentist
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const newDentist = new Dentist({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      specialization: req.body.specialization,
      experience: req.body.experience,
      availability: req.body.availability,
      bio: req.body.bio
    });

    const dentist = await newDentist.save();
    res.json(dentist);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT api/dentists/:id
// @desc    Update a dentist
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const dentist = await Dentist.findById(req.params.id);

    if (!dentist) {
      return res.status(404).json({ message: 'Dentist not found' });
    }

    // Update fields
    const { name, email, phone, specialization, experience, availability, bio } = req.body;
    if (name) dentist.name = name;
    if (email) dentist.email = email;
    if (phone) dentist.phone = phone;
    if (specialization) dentist.specialization = specialization;
    if (experience) dentist.experience = experience;
    if (availability) dentist.availability = availability;
    if (bio) dentist.bio = bio;

    await dentist.save();
    res.json(dentist);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE api/dentists/:id
// @desc    Delete a dentist
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const dentist = await Dentist.findById(req.params.id);

    if (!dentist) {
      return res.status(404).json({ message: 'Dentist not found' });
    }

    await dentist.remove();
    res.json({ message: 'Dentist removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router; 