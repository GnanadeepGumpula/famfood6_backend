# FamFood6 Backend - Setup & Next Steps Guide

## ✅ What Has Been Fixed

### Critical Issues Resolved:
1. **JWT_SECRET Security** - Now requires env variable; throws error in production if missing
2. **OTP Rate Limiting** - Added rate limiting to prevent brute force attacks
   - Send OTP: 5 requests per 15 minutes
   - Verify OTP: 10 attempts per 5 minutes
3. **Loyalty Calculation Bug** - Fixed free item logic
4. **Package Dependencies** - npm install now works (fixed jsonwebtoken version issue)
5. **.env File** - Created with placeholders for all required env variables

---

## 🚀 IMMEDIATE NEXT STEPS (Do This First)

### 1. **Configure Environment Variables**
Edit `.env` file and add your actual values:

```bash
# MongoDB - Get connection string from MongoDB Atlas
MONGO_URI=mongodb+srv://your_username:your_password@your_cluster.mongodb.net/famfood6

# Generate a strong JWT secret (use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=your-generated-secret-here

# WhatsApp Integration (get from Meta WhatsApp Business API)
WHATSAPP_TOKEN=your_token_here
WHATSAPP_PHONE_ID=your_phone_id_here

# Update domain for your deployment
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

NODE_ENV=development
```

### 2. **Start Development Server**
```bash
npm run dev
```
Server will run at `http://localhost:3000`

### 3. **Test Endpoints**
Create a `.rest` file or use Postman to test:
```
POST http://localhost:3000/api/auth/send-otp
Content-Type: application/json

{ "mobileNumber": "9876543210" }
```

---

## 🔧 PENDING FEATURES TO IMPLEMENT

### 1. **Socket.io Integration** ⚠️ INCOMPLETE
**Status**: Defined but not initialized
**What needs to be done**:
- Initialize Socket.io server in `next.config.mjs` or separate server
- Create WebSocket connection handler for real-time order updates
- Emit events when order status changes
- Connect database updates to socket broadcasts

**Impact**: Order status updates won't be real-time without this

### 2. **WhatsApp Templates Setup** ⚠️ INCOMPLETE
**Status**: Functions ready, templates not configured
**What needs to be done**:
1. Create WhatsApp Business templates in Meta WhatsApp Manager:
   - `order_placed_notification`
   - `order_accepted_notification`
   - `order_rejected_notification`
   - `order_ready_notification`
2. Activate templates for your WhatsApp number
3. Update `WHATSAPP_PHONE_ID` in `.env`

**Current behavior**: Messages will fail silently if templates missing

### 3. **Admin User Creation** ⚠️ MISSING
**What needs to be done**:
Create a seeding script to initialize first admin:
```typescript
// Example script: npm run seed
const admin = await User.create({
  mobileNumber: "9999999999",
  profileDetails: { name: "Admin" },
  loyaltyCounter: {},
  role: "admin" // Add this role field to User schema
});
```

### 4. **OTP Persistence** ⚠️ NOT PRODUCTION-READY
**Current issue**: OTP stored in memory - lost on server restart
**Production fix**: Move to Redis or MongoDB
```typescript
// Replace in_memory Map with Redis:
import redis from 'redis';
const redisClient = redis.createClient();
```

### 5. **API Documentation** ⚠️ MISSING
Create API docs using Swagger/OpenAPI:
```bash
npm install swagger-ui-express swagger-jsdoc
```

### 6. **Authentication Endpoints Missing**
Add these routes:
- `POST /api/auth/logout` - Token blacklist
- `POST /api/auth/refresh` - Refresh JWT token
- `DELETE /api/auth/tokens` - Invalidate all tokens

---

## 📊 API ENDPOINTS SUMMARY

### Authentication
- `POST /api/auth/send-otp` - Request OTP
- `POST /api/auth/verify-otp` - Verify OTP & get JWT

### Menu Management (Admin)
- `GET /api/menu` - List all menu items
- `POST /api/menu` - Create menu item (admin only)
- `GET /api/menu/[id]` - Get menu item details
- `PUT /api/menu/[id]` - Update menu item (admin only)
- `DELETE /api/menu/[id]` - Delete menu item (admin only)

### Orders
- `POST /api/orders` - Create new order
- `GET /api/orders` - Get all orders (admins see all, users see own)
- `GET /api/orders/[id]` - Get order details
- `PUT /api/orders/[id]/status` - Update order status (admin only)

### User Profile
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/orders` - Get user's order history
- `GET /api/users/loyalty` - Get loyalty points

### Analytics (Admin Only)
- `GET /api/analytics/daily?date=2026-03-11` - Daily stats
- `GET /api/analytics/monthly?month=2026-03` - Monthly stats
- `GET /api/analytics/yearly?year=2026` - Yearly stats

---

## 🐛 KNOWN ISSUES & WORKAROUNDS

| Issue | Severity | Status | Workaround |
|-------|----------|--------|-----------|
| Socket.io not initialized | High | Pending | Use polling for order updates |
| OTP in memory storage | Medium | Pending | Use Redis/DB backup |
| No admin role in User model | High | Pending | Add `role: enum['user', 'admin']` to User schema |
| WhatsApp templates unconfigured | Medium | Pending | Configure in Meta dashboard |
| No transaction support | Low | Design | Use MongoDB transactions if needed |

---

## 📦 PROJECT STRUCTURE

```
app/
├── api/
│   ├── auth/          ✅ OTP login system
│   ├── menu/          ✅ Food items management
│   ├── orders/        ✅ Order processing
│   ├── users/         ✅ User profile
│   └── analytics/     ✅ Admin dashboard stats

lib/
├── models/            ✅ MongoDB schemas
├── middleware/        ⚠️ Auth & Loyalty (rate limiting added)
├── utils/             ✅ Helpers
└── db/                ✅ Database connection

components/           🎨 UI (Shadcn/Radix)
public/               📁 Static files
styles/               🎨 CSS
```

---

## 🔐 Security Checklist

- [x] JWT secret required from env
- [x] Rate limiting on OTP endpoints
- [x] Admin authorization checks
- [x] Mobile number validation
- [x] OTP expiry (10 min)
- [ ] CORS headers configured
- [ ] SQL injection protected (using Mongoose)
- [ ] XSS protected (using Next.js)
- [ ] HTTPS required in production
- [ ] Database credentials not in code

---

## 🧪 TESTING COMMANDS

```bash
# Start dev server
npm run dev

# Build for production
npm build

# Type checking
npx tsc --noEmit

# Lint code
npm run lint
```

---

## 📝 DEPENDENCIES INSTALLED

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.1.6 | Framework |
| mongoose | ^8.0.0 | MongoDB ORM |
| jsonwebtoken | ^9.0.2 | JWT auth |
| axios | ^1.6.0 | HTTP client |
| socket.io | ^4.7.2 | Real-time updates ⚠️ Not initialized |
| zod | ^3.24.1 | Validation |

---

## 🎯 PRIORITY ROADMAP

**Week 1** (Critical):
1. ✅ Fix security issues
2. ✅ Install dependencies
3. 🔄 Configure MongoDB & WhatsApp
4. ➡️ Initialize Socket.io
5. ➡️ Add admin role to User schema

**Week 2** (Important):
6. ➡️ Create SMS/WhatsApp templates
7. ➡️ Setup API documentation
8. ➡️ Add integration tests
9. ➡️ Deploy to staging

**Week 3** (Nice to Have):
10. ➡️ Add payment gateway
11. ➡️ Implement push notifications
12. ➡️ Add order tracking map
13. ➡️ Analytics dashboard frontend

---

## 📞 ENVIRONMENT SETUP EXAMPLE

**For Development**:
```bash
MONGO_URI=mongodb://localhost:27017/famfood6
JWT_SECRET=dev-secret-change-in-production
NODE_ENV=development
WHATSAPP_TOKEN=your_test_token
```

**For Production**:
```bash
MONGO_URI=mongodb+srv://prod_user:password@prod-cluster.mongodb.net/famfood6
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
NODE_ENV=production
WHATSAPP_TOKEN=your_production_token
ALLOWED_ORIGINS=https://yourdomain.com
```

---

## 🆘 COMMON ISSUES

**Issue**: `MONGO_URI is not set`
**Solution**: Add `MONGO_URI` to `.env` file

**Issue**: `JWT_SECRET is not configured`
**Solution**: Generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**Issue**: Port 3000 already in use
**Solution**: `npm run dev -- -p 3001`

---

## 📚 ADDITIONAL RESOURCES

- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Mongoose Documentation](https://mongoosejs.com)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8949)
- [WhatsApp API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)

**Last Updated**: March 11, 2026
