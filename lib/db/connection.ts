import mongoose, { Connection } from 'mongoose';

let cachedConnection: Connection | null = null;

export async function connectToDatabase(): Promise<Connection> {
  if (cachedConnection) {
    return cachedConnection;
  }

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI environment variable is not set');
  }

  try {
    const connection = await mongoose.connect(mongoUri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 20000,
      family: 4,
    });

    cachedConnection = connection.connection;
    console.log('Connected to MongoDB');
    return cachedConnection;
  } catch (error) {
    if (error instanceof mongoose.Error.MongooseServerSelectionError) {
      console.error(
        'MongoDB Atlas connection failed. Check Network Access whitelist, DB user credentials, and cluster status.',
      );
    }
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  if (cachedConnection) {
    await mongoose.disconnect();
    cachedConnection = null;
    console.log('Disconnected from MongoDB');
  }
}
