import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartbuild';
  try {
    await mongoose.connect(uri);
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
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
