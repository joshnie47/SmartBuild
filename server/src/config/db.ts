import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();

// Force Google DNS to resolve MongoDB Atlas SRV records
// (ISP DNS may block _mongodb._tcp SRV lookups)
dns.setServers(['8.8.8.8', '8.8.4.4']);

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartbuild';
  try {
    await mongoose.connect(uri);
    console.log(`====================================`);
    console.log(`✅ MongoDB connected successfully!`);
    console.log(`   Host: ${mongoose.connection.host}`);
    console.log(`   Database: ${mongoose.connection.name}`);
    console.log(`====================================`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
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
