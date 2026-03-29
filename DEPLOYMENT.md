# Vercel Deployment Guide

## 1. Local pre-check (must pass)

Run these commands before pushing:

```bash
npm install
npm run build
```

The build command now runs TypeScript checking before Next.js build. If this passes locally, Vercel build is much less likely to fail.

## 2. Required Vercel project settings

- Framework preset: Next.js
- Root directory: repository root
- Build command: npm run build
- Install command: npm install
- Node.js version: 20.x or 22.x (recommended)

## 3. Required environment variables in Vercel

Copy values from your secure local setup and add them in Vercel Project Settings -> Environment Variables:

- NODE_ENV=production
- MONGO_URI
- JWT_SECRET
- ALLOWED_ORIGINS
- OTP_EXPIRY
- ADMIN_PHONES
- WHATSAPP_TOKEN
- WHATSAPP_PHONE_ID
- WHATSAPP_COUNTRY_CODE
- WHATSAPP_TEMPLATE_LANGUAGE
- WHATSAPP_OTP_TEMPLATE
- WHATSAPP_OTP_PARAM_KEYS
- WHATSAPP_ORDER_PLACED_TEMPLATE
- WHATSAPP_ORDER_ACCEPTED_TEMPLATE
- WHATSAPP_ORDER_REJECTED_TEMPLATE
- WHATSAPP_ORDER_READY_TEMPLATE
- RESTAURANT_LOCATION_LINK (optional)
- GOOGLE_MAPS_LINK (optional)

Use .env.example in this repository as the source-of-truth key list.

For a single deployed backend that should be callable from any frontend origin, set:

- ALLOWED_ORIGINS=*

For stricter security, provide a comma-separated allowlist instead:

- ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:8080

## 4. Production behavior to know

- OTP text fallback is blocked in hosted production if WHATSAPP_OTP_TEMPLATE is missing.
- CORS is applied in proxy.ts for all /api/* routes.
- MongoDB connection requires MONGO_URI at runtime.

## 5. Recommended release workflow

1. Create feature branch.
2. Push and open PR.
3. GitHub Actions CI runs npm run build.
4. Merge to main only after CI passes.
5. Vercel deploys main.
6. Smoke-test these endpoints:
   - GET /api
   - POST /api/auth/send-otp
   - POST /api/auth/verify-otp
   - POST /api/orders

## 6. Fast rollback

If a release fails after deploy:

1. Roll back to previous Vercel deployment from the Vercel dashboard.
2. Revert the failing commit in Git.
3. Re-run CI and deploy.
