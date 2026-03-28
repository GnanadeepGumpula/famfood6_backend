import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({
    name: 'famFood6 Backend',
    status: 'ok',
    message: 'Backend API is running',
    docsHint: 'Use /api/* routes to access backend endpoints.',
  })
}
