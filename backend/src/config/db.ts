import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

mongoose.set('strictQuery', true);

export async function connectDb(): Promise<void> {
  await mongoose.connect(env.MONGO_URI, { autoIndex: true });
  logger.info({ uri: env.MONGO_URI }, 'MongoDB connected');
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
