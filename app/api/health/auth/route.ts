import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/connection';

export async function GET() {
  const jwtSecretConfigured = Boolean(process.env.JWT_SECRET);
  const mongoConfigured = Boolean(process.env.MONGO_URI);

  let databaseConnected = false;
  let databaseError: string | undefined;

  try {
    await connectToDatabase();
    databaseConnected = true;
  } catch (error: any) {
    databaseError = error?.message || 'Database connection failed';
  }

  const ready = jwtSecretConfigured && mongoConfigured && databaseConnected;

  return NextResponse.json(
    {
      success: ready,
      data: {
        ready,
        checks: {
          jwtSecretConfigured,
          mongoConfigured,
          databaseConnected,
        },
        databaseError: databaseError || null,
      },
      message: ready
        ? 'Auth system is healthy'
        : 'Auth system is not fully configured',
    },
    { status: ready ? 200 : 503 }
  );
}
