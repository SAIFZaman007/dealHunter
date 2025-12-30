# Custom GPT Marketplace Backend

Backend API for selling Custom GPT tools with subscription-based access.

## Features

- ✅ User authentication & authorization (JWT)
- ✅ GPT product management
- ✅ Subscription plans (monthly/annual)
- ✅ **Stripe payment integration with webhooks**
- ✅ User dashboard & admin panel
- ✅ API access management
- ✅ Order tracking
- ✅ Payment history
- ✅ Automated subscription activation
- ✅ Refund processing (Admin)

## Tech Stack

- **Node.js** with Express.js
- **Prisma ORM** with PostgreSQL
- **JWT** for authentication
- **Stripe** for payments
- **OpenAI API** integration

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your actual credentials
```

3. Set up database:
```bash
npm run prisma:migrate
npm run prisma:generate
```

4. Seed initial data (optional):
```bash
npm run prisma:seed
```

5. Start development server:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/update-profile` - Update profile

### GPT Products
- `GET /api/gpts` - Get all GPTs
- `GET /api/gpts/:id` - Get single GPT
- `POST /api/gpts` - Create GPT (Admin)
- `PUT /api/gpts/:id` - Update GPT (Admin)
- `DELETE /api/gpts/:id` - Delete GPT (Admin)

### Subscriptions
- `GET /api/subscriptions/plans` - Get all plans
- `GET /api/subscriptions/my-subscriptions` - Get user subscriptions
- `POST /api/subscriptions/subscribe` - Subscribe to plan
- `POST /api/subscriptions/cancel` - Cancel subscription

### **Payments (Stripe Integration)**
- `POST /api/payments/create-checkout-session` - Create Stripe checkout
- `POST /api/payments/webhook` - Handle Stripe webhooks
- `GET /api/payments/verify-session/:sessionId` - Verify payment status
- `GET /api/payments/history` - Get payment history
- `POST /api/payments/refund` - Process refund (Admin)

### Orders
- `POST /api/orders/create` - Create order
- `GET /api/orders` - Get user orders
- `GET /api/orders/:id` - Get order details

### Admin
- `GET /api/admin/users` - Get all users
- `GET /api/admin/orders` - Get all orders
- `GET /api/admin/stats` - Get dashboard stats

## Project Structure

```
src/
├── config/          # Configuration files
│   └── database.js  # Prisma client
├── controllers/     # Request handlers
│   ├── auth.controller.js
│   ├── gpt.controller.js
│   ├── order.controller.js
│   ├── payment.controller.js      # ⭐ Stripe payment handling
│   ├── subscription.controller.js
│   └── admin.controller.js
├── middleware/      # Custom middleware
│   ├── auth.js      # JWT authentication
│   ├── isAdmin.js   # Admin authorization
│   └── errorHandler.js
├── routes/          # API routes
│   ├── auth.routes.js
│   ├── gpt.routes.js
│   ├── order.routes.js
│   ├── payment.routes.js          # ⭐ Payment endpoints
│   ├── subscription.routes.js
│   └── admin.routes.js
├── services/        # Business logic
│   ├── auth.service.js
│   ├── email.service.js
│   └── stripe.service.js          # ⭐ Stripe integration
└── server.js        # Entry point
```

## Payment Integration

This project includes a complete Stripe payment system with webhook support.

### Quick Start (Testing Payments)

1. **Add Stripe keys to `.env`**:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

2. **Start server**:
   ```bash
   npm run dev
   ```

3. **Set up webhooks** (in another terminal):
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/payments/webhook
   ```

4. **Test with Postman**:
   - Import `Stripe_Payment_API.postman_collection.json`
   - Run: Login → Get Plans → Create Checkout Session
   - Open checkout URL in browser
   - Use test card: `4242 4242 4242 4242`

### Documentation

- 📖 [**STRIPE_QUICK_START.md**](STRIPE_QUICK_START.md) - Quick testing guide
- 📖 [**STRIPE_INTEGRATION.md**](STRIPE_INTEGRATION.md) - Complete technical documentation
- 📖 [**PAYMENT_FLOW_DIAGRAM.md**](PAYMENT_FLOW_DIAGRAM.md) - Visual flow diagrams
- 📖 [**FRONTEND_INTEGRATION_EXAMPLES.js**](FRONTEND_INTEGRATION_EXAMPLES.js) - Frontend code examples
- 📖 [**IMPLEMENTATION_SUMMARY.md**](IMPLEMENTATION_SUMMARY.md) - Implementation overview

### Test Cards

| Card Number | Result |
|------------|---------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0025 0000 3155` | 3D Secure |

## License

ISC
