import mongoose from 'mongoose';

/**
 * Creates a tenant-aware schema by adding tenantId field and query middleware
 * to automatically filter by tenant
 * 
 * @param {mongoose.Schema} schema - The mongoose schema to make tenant-aware
 * @returns {mongoose.Schema} The tenant-aware schema
 */
export const createTenantAwareSchema = (schema) => {
  // Add tenantId field to schema if it doesn't already exist
  if (!schema.path('tenantId')) {
    schema.add({
      tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Clinic',
        required: true,
        index: true
      }
    });
  }

  // Add compound index for common queries
  schema.index({ tenantId: 1, createdAt: -1 });

  // Add middleware to automatically filter by tenant ID
  // This ensures that queries only return data for the current tenant
  schema.pre('find', function() {
    // Skip tenant filtering if explicitly disabled
    if (this.getOptions().skipTenantFilter) {
      return;
    }
    
    // If tenantId isn't already in the query conditions and we have a tenantId context
    if (!this._conditions.tenantId && this.model._tenantId) {
      this._conditions.tenantId = this.model._tenantId;
    }
  });

  // Apply same tenant filtering to findOne queries
  schema.pre('findOne', function() {
    if (this.getOptions().skipTenantFilter) {
      return;
    }
    
    if (!this._conditions.tenantId && this.model._tenantId) {
      this._conditions.tenantId = this.model._tenantId;
    }
  });

  // Apply tenant filtering to count queries
  schema.pre('count', function() {
    if (this.getOptions().skipTenantFilter) {
      return;
    }
    
    if (!this._conditions.tenantId && this.model._tenantId) {
      this._conditions.tenantId = this.model._tenantId;
    }
  });

  // Apply tenant filtering to countDocuments queries
  schema.pre('countDocuments', function() {
    if (this.getOptions().skipTenantFilter) {
      return;
    }
    
    if (!this._conditions.tenantId && this.model._tenantId) {
      this._conditions.tenantId = this.model._tenantId;
    }
  });

  // Apply tenant filtering to update queries
  schema.pre('updateOne', function() {
    if (this.getOptions().skipTenantFilter) {
      return;
    }
    
    if (!this._conditions.tenantId && this.model._tenantId) {
      this._conditions.tenantId = this.model._tenantId;
    }
  });

  // Apply tenant filtering to updateMany queries
  schema.pre('updateMany', function() {
    if (this.getOptions().skipTenantFilter) {
      return;
    }
    
    if (!this._conditions.tenantId && this.model._tenantId) {
      this._conditions.tenantId = this.model._tenantId;
    }
  });

  // Apply tenant filtering to deleteOne queries
  schema.pre('deleteOne', function() {
    if (this.getOptions().skipTenantFilter) {
      return;
    }
    
    if (!this._conditions.tenantId && this.model._tenantId) {
      this._conditions.tenantId = this.model._tenantId;
    }
  });

  // Apply tenant filtering to deleteMany queries
  schema.pre('deleteMany', function() {
    if (this.getOptions().skipTenantFilter) {
      return;
    }
    
    if (!this._conditions.tenantId && this.model._tenantId) {
      this._conditions.tenantId = this.model._tenantId;
    }
  });

  // Ensure tenantId is set on all new documents
  schema.pre('save', function(next) {
    if (!this.tenantId && this.constructor._tenantId) {
      this.tenantId = this.constructor._tenantId;
    }
    next();
  });

  return schema;
};

/**
 * Creates a model with tenant context
 * 
 * @param {string} name - The model name
 * @param {mongoose.Schema} schema - The mongoose schema
 * @returns {mongoose.Model} The tenant-aware model
 */
export const createTenantModel = (name, schema) => {
  // Make the schema tenant-aware
  const tenantSchema = createTenantAwareSchema(schema);
  
  // Create the model
  const Model = mongoose.model(name, tenantSchema);
  
  // Add a method to set the tenant context for queries
  Model.setTenantContext = function(tenantId) {
    this._tenantId = tenantId;
    return this;
  };
  
  // Add a method to bypass tenant filtering for specific queries
  Model.skipTenantFilter = function() {
    return this.find().setOptions({ skipTenantFilter: true });
  };
  
  return Model;
};

export default { createTenantAwareSchema, createTenantModel };
