import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Cache for database connections
const connections = {};

/**
 * Get a database connection for a specific tenant
 * For the shared database approach, this will return the default connection
 * For database-per-tenant, this would create/retrieve a separate connection
 * 
 * @param {string} tenantId - The tenant ID
 * @returns {mongoose.Connection} The database connection
 */
export const getConnection = async (tenantId) => {
  // For shared database approach, return the default connection
  if (!tenantId || process.env.MULTI_TENANT_STRATEGY === 'SHARED_SCHEMA') {
    return mongoose.connection;
  }
  
  // For database-per-tenant approach
  if (process.env.MULTI_TENANT_STRATEGY === 'DATABASE_PER_TENANT') {
    // Return cached connection if it exists
    if (connections[tenantId]) {
      return connections[tenantId];
    }
    
    // Create a new connection for this tenant
    const dbUri = `${process.env.MONGODB_URI_PREFIX}${tenantId}`;
    
    try {
      connections[tenantId] = await mongoose.createConnection(dbUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4 // Force IPv4
      });
      
      console.log(`Connected to tenant database: ${tenantId}`);
      return connections[tenantId];
    } catch (error) {
      console.error(`Error connecting to tenant database ${tenantId}:`, error);
      throw error;
    }
  }
  
  // Default to shared database if strategy not specified
  return mongoose.connection;
};

/**
 * Set the tenant context for a model
 * This is used to automatically filter queries by tenant
 * 
 * @param {mongoose.Model} model - The mongoose model
 * @param {string} tenantId - The tenant ID
 * @returns {mongoose.Model} The model with tenant context
 */
export const setTenantContext = (model, tenantId) => {
  if (model.setTenantContext && tenantId) {
    return model.setTenantContext(tenantId);
  }
  return model;
};

/**
 * Close all database connections
 * This should be called when shutting down the application
 */
export const closeAllConnections = async () => {
  const connectionPromises = Object.values(connections).map(conn => conn.close());
  await Promise.all(connectionPromises);
  connections = {};
  console.log('Closed all tenant database connections');
};

export default { getConnection, setTenantContext, closeAllConnections };
