import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../server/.env') });

// Force Google DNS to resolve MongoDB Atlas SRV records when possible
// (ISP DNS may block _mongodb._tcp SRV lookups; fall back gracefully in containers)
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch {
  // Use system default DNS resolvers
}

import { migrateVerificationStatus } from '../utils/migrateVerification';

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartbuild';
  try {
    await mongoose.connect(uri);
    console.log(`====================================`);
    console.log(`✅ MongoDB connected successfully!`);
    console.log(`   Host: ${mongoose.connection.host}`);
    console.log(`   Database: ${mongoose.connection.name}`);
    console.log(`====================================`);
    // Run verification migration in background so connection unblocks immediately
    migrateVerificationStatus().catch((err) => {
      console.error('[Migration] Verification migration error:', err);
    });
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
  }
}

export function getDBStatus(): { connected: boolean; host: string | undefined; dbName: string | undefined } {
  const state = mongoose.connection.readyState;
  return {
    connected: state === 1,
    host: mongoose.connection.host || undefined,
    dbName: mongoose.connection.name || undefined,
  };
}
