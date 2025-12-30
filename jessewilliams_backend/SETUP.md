# Getting Started Guide

## Prerequisites
- Node.js (v16 or higher)
- PostgreSQL database
- Stripe account (for payments)
- OpenAI API key (for GPT integration)

## Installation Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy the example environment file and update with your credentials:
```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `DATABASE_URL` - Your PostgreSQL connection string
- `JWT_SECRET` - A secure random string for JWT tokens
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `OPENAI_API_KEY` - Your OpenAI API key
- `EMAIL_*` - Your email service credentials

### 3. Set Up Database
Run Prisma migrations to create database tables:
```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. Seed Initial Data (Optional)
Populate the database with sample data:
```bash
npm run prisma:seed
```

This will create:
- Admin user (email: admin@addvancedai.com, password: Admin@123456)
- 3 GPT products (Deal Hunter, Underwriting, Offer/Outreach)
- Sample subscription plans

### 5. Start Development Server
```bash
npm run dev
```

The server will start on `http://localhost:5000`

## Testing the API

### Health Check
```bash
curl http://localhost:5000/health
```

### Register a User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!"
  }'
```

### Get All GPTs
```bash
curl http://localhost:5000/api/gpts
```

## Database Management

### Open Prisma Studio (Database GUI)
```bash
npm run prisma:studio
```

This will open a web interface at `http://localhost:5555` where you can view and edit your database records.

### Create a New Migration
After changing the Prisma schema:
```bash
npm run prisma:migrate
```

## Project Structure
```
src/
├── config/
│   └── database.js          # Prisma client configuration
├── controllers/             # Request handlers
│   ├── auth.controller.js
│   ├── gpt.controller.js
│   ├── subscription.controller.js
│   ├── order.controller.js
│   ├── admin.controller.js
│   └── contact.controller.js
├── middleware/              # Custom middleware
│   ├── auth.js             # JWT authentication
│   ├── isAdmin.js          # Admin authorization
│   └── errorHandler.js     # Global error handler
├── routes/                  # API routes
│   ├── auth.routes.js
│   ├── gpt.routes.js
│   ├── subscription.routes.js
│   ├── order.routes.js
│   ├── admin.routes.js
│   └── contact.routes.js
└── server.js               # Express app entry point

prisma/
├── schema.prisma           # Database schema
└── seed.js                 # Database seeder
```

## Next Steps

1. **Set up Stripe Webhooks**: Configure Stripe webhooks to handle payment events
2. **Email Integration**: Configure email service for notifications
3. **OpenAI Integration**: Implement GPT API calls in a service layer
4. **API Documentation**: Consider adding Swagger/OpenAPI documentation
5. **Testing**: Add unit and integration tests
6. **Deployment**: Deploy to your hosting provider (HostGator VPS, AWS, etc.)

## Troubleshooting

### Database Connection Issues
- Verify your `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running
- Check firewall settings

### Migration Errors
- Delete `prisma/migrations` folder and run `npm run prisma:migrate` again
- Or use `prisma migrate reset` to reset the database (warning: deletes all data)

### Port Already in Use
- Change the `PORT` in `.env` file
- Or kill the process using port 5000

## Support
For issues or questions, refer to:
- [Prisma Documentation](https://www.prisma.io/docs)
- [Express.js Documentation](https://expressjs.com)
- [Stripe API Documentation](https://stripe.com/docs/api)
