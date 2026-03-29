import { NextResponse } from 'next/server'

type ApiEndpoint = {
  path: string
  methods: string[]
}

const endpoints: ApiEndpoint[] = [
  { path: '/api/auth/send-otp', methods: ['POST'] },
  { path: '/api/auth/verify-otp', methods: ['POST'] },
  { path: '/api/auth/login-password', methods: ['POST'] },
  { path: '/api/auth/set-password', methods: ['POST'] },
  { path: '/api/auth/change-password', methods: ['POST'] },
  { path: '/api/menu', methods: ['GET', 'POST'] },
  { path: '/api/menu/:id', methods: ['PUT', 'DELETE'] },
  { path: '/api/orders', methods: ['POST', 'GET'] },
  { path: '/api/orders/:id', methods: ['GET', 'PATCH'] },
  { path: '/api/orders/:id/cancel', methods: ['PATCH'] },
  { path: '/api/orders/:id/status', methods: ['PUT'] },
  { path: '/api/users/profile', methods: ['GET', 'PUT'] },
  { path: '/api/users/orders', methods: ['GET'] },
  { path: '/api/users/loyalty', methods: ['GET'] },
  { path: '/api/analytics/daily', methods: ['GET'] },
  { path: '/api/analytics/monthly', methods: ['GET'] },
  { path: '/api/analytics/yearly', methods: ['GET'] },
  { path: '/api/analytics/top-items', methods: ['GET'] },
]

export async function GET() {
  return NextResponse.json({
    name: 'famFood6 Backend API',
    status: 'ok',
    totalEndpoints: endpoints.length,
    endpoints,
  })
}
