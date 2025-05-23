import request from 'supertest';
import app from '../server.js';
import Clinic from '../models/Clinic.js';
import { connect, clear, close } from './testDb.js';

describe('Clinic Subscription & Feature Management', () => {
  let token;
  let clinicId;

  beforeAll(async () => {
    await connect();
  });

  afterEach(async () => {
    await clear();
  });

  afterAll(async () => {
    await close();
  });

  // Setup test clinic and get auth token
  beforeEach(async () => {
    // Create test admin user and get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'password123'
      });

    token = loginRes.body.token;

    // Create test clinic
    const clinicRes = await request(app)
      .post('/api/clinics')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Clinic',
        address1: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        country: 'Test Country',
        zipcode: '12345',
        contact: '1234567890',
        clinicContact: '0987654321',
        doctorName: 'Dr. Test',
        email: 'clinic@test.com'
      });

    clinicId = clinicRes.body.data._id;
  });

  describe('Subscription Management', () => {
    it('should update clinic subscription plan', async () => {
      const res = await request(app)
        .put(`/api/clinics/${clinicId}/subscription`)
        .set('Authorization', `Bearer ${token}`)
        .send({ plan: 'Pro' });

      expect(res.status).toBe(200);
      expect(res.body.data.subscriptionPlan).toBe('Pro');
      expect(res.body.data.features.maxDoctors).toBe(5);
      expect(res.body.data.features.maxPatients).toBe(500);
      expect(res.body.data.features.allowedModules).toContain('inventory');
    });

    it('should restrict access to features not in subscription plan', async () => {
      // Try to access inventory feature with Free plan
      const res = await request(app)
        .get(`/api/clinics/${clinicId}/features/inventory`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.hasAccess).toBe(false);
    });
  });

  describe('Resource Limits', () => {
    it('should enforce doctor limit based on subscription plan', async () => {
      // Add doctors until limit
      for (let i = 0; i < 2; i++) {
        await request(app)
          .post('/api/staff')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: `Doctor ${i}`,
            email: `doctor${i}@test.com`,
            role: 'Doctor'
          });
      }

      // Try to add one more doctor (should fail on Free plan)
      const res = await request(app)
        .post('/api/staff')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Extra Doctor',
          email: 'extra@test.com',
          role: 'Doctor'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('maximum limit for doctors');
    });

    it('should return correct resource limits', async () => {
      const res = await request(app)
        .get(`/api/clinics/${clinicId}/limits`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('doctors');
      expect(res.body.data).toHaveProperty('patients');
      expect(res.body.data.doctors.max).toBe(1); // Free plan limit
    });
  });

  describe('Settings Management', () => {
    it('should update clinic settings', async () => {
      const settings = {
        workingHours: {
          start: '08:00',
          end: '18:00'
        },
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        appointmentDuration: 45,
        timezone: 'America/New_York',
        currency: 'USD'
      };

      const res = await request(app)
        .put(`/api/clinics/${clinicId}/settings`)
        .set('Authorization', `Bearer ${token}`)
        .send({ settings });

      expect(res.status).toBe(200);
      expect(res.body.data.settings.workingHours.start).toBe('08:00');
      expect(res.body.data.settings.appointmentDuration).toBe(45);
    });
  });
});