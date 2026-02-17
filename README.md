# City of God Foodbank - Voucher Management System (Backend)

Backend API for the City of God Foodbank Voucher Management System, built with Node.js and Supabase.

## 🏗️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Logging**: Winston
- **Validation**: Joi / Express Validator

## 📋 Features

- ✅ Role-based access control (Super Admin, Centre Admin, Staff, Read-only)
- ✅ Multi-centre support with data isolation
- ✅ Client management with consent handling
- ✅ Voucher issuance with repeat voucher logic (≥3 in 6 months)
- ✅ Comprehensive audit logging
- ✅ Dashboard and reporting
- ✅ GDPR-compliant data handling
- ✅ Row Level Security (RLS) at database level

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- A Supabase account and project

### Installation

1. **Clone the repository** (or create it if this is a new project)

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```

   Then edit `.env` with your Supabase credentials:
   ```env
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

4. **Set up the database**:
   
   a. Go to your Supabase project dashboard
   
   b. Navigate to SQL Editor
   
   c. Copy and run the contents of `src/database/schema.sql`
   
   This will create:
   - All tables (users, clients, vouchers, centres, etc.)
   - Enums for roles and statuses
   - Indexes for performance
   - Row Level Security (RLS) policies
   - Functions and triggers
   - Seed data for reference tables

5. **Create your first admin user**:
   
   In Supabase dashboard:
   - Go to Authentication > Users
   - Create a new user with email/password
   - Then in SQL Editor, run:
   ```sql
   INSERT INTO users (id, email, first_name, last_name, role)
   VALUES (
     'USER_UUID_FROM_AUTH_USERS',
     'admin@foodbank.org',
     'Admin',
     'User',
     'super_admin'
   );
   ```

6. **Create your first centre** (in SQL Editor):
   ```sql
   INSERT INTO centres (name, address, postcode, phone, email, delivery_available)
   VALUES (
     'Main Centre',
     '123 Main Street',
     'AB12 3CD',
     '+44 1234 567890',
     'main@foodbank.org',
     true
   );
   ```

7. **Assign admin to centre**:
   ```sql
   INSERT INTO centre_assignments (user_id, centre_id)
   VALUES (
     'ADMIN_USER_UUID',
     (SELECT id FROM centres WHERE name = 'Main Centre')
   );
   ```

### Running the Application

**Development mode** (with auto-reload):
```bash
npm run dev
```

**Production mode**:
```bash
npm start
```

The server will start on `http://localhost:3000`

## 📁 Project Structure

```
voucher-management-system/
├── src/
│   ├── config/
│   │   └── supabase.js          # Supabase client configuration
│   ├── controllers/              # Request handlers
│   │   ├── client.controller.js
│   │   ├── voucher.controller.js
│   │   ├── auth.controller.js
│   │   └── ...
│   ├── database/
│   │   └── schema.sql            # Database schema and migrations
│   ├── middleware/
│   │   ├── auth.js               # Authentication & authorization
│   │   ├── errorHandler.js
│   │   └── requestLogger.js
│   ├── routes/                   # API route definitions
│   │   ├── client.routes.js
│   │   ├── voucher.routes.js
│   │   └── ...
│   ├── services/                 # Business logic
│   │   ├── client.service.js
│   │   ├── voucher.service.js
│   │   └── audit.service.js
│   ├── utils/
│   │   └── logger.js             # Winston logger
│   └── server.js                 # Application entry point
├── logs/                         # Log files (created at runtime)
├── .env                          # Environment variables (not in git)
├── .env.example                  # Environment template
├── .gitignore
├── package.json
└── README.md
```

## 🔑 API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/me` - Get current user

### Clients
- `GET /api/v1/clients` - List clients (with search/filter)
- `GET /api/v1/clients/:id` - Get client details
- `GET /api/v1/clients/:id/history` - Get client voucher history
- `POST /api/v1/clients` - Create client
- `PATCH /api/v1/clients/:id` - Update client
- `DELETE /api/v1/clients/:id` - Delete client

### Vouchers
- `GET /api/v1/vouchers` - List vouchers
- `GET /api/v1/vouchers/:id` - Get voucher details
- `GET /api/v1/vouchers/code/:code` - Get voucher by code
- `POST /api/v1/vouchers` - Issue voucher
- `POST /api/v1/vouchers/check-repeat` - Check repeat voucher status
- `PATCH /api/v1/vouchers/:id` - Update voucher
- `PATCH /api/v1/vouchers/:id/fulfill` - Mark as fulfilled
- `PATCH /api/v1/vouchers/:id/cancel` - Cancel voucher
- `GET /api/v1/vouchers/:id/print` - Get printable voucher

### Centres
- `GET /api/v1/centres` - List centres
- `GET /api/v1/centres/:id` - Get centre details
- `POST /api/v1/centres` - Create centre
- `PATCH /api/v1/centres/:id` - Update centre
- `DELETE /api/v1/centres/:id` - Delete centre

### Reports
- `GET /api/v1/reports/dashboard` - Dashboard statistics
- `GET /api/v1/reports/vouchers` - Voucher report
- `GET /api/v1/reports/clients` - Client report
- `GET /api/v1/reports/export` - Export data (CSV/XLSX)

### Audit
- `GET /api/v1/audit` - Get audit logs
- `GET /api/v1/audit/:id` - Get audit log details

### Users
- `GET /api/v1/users` - List users
- `GET /api/v1/users/:id` - Get user details
- `POST /api/v1/users` - Create user
- `PATCH /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Deactivate user
- `POST /api/v1/users/:id/assign-centres` - Assign centres

## 🔐 Security Features

### Row Level Security (RLS)
All data access is controlled at the database level using PostgreSQL RLS policies:
- Users can only access data from centres they're assigned to
- Super admins have full access
- Read-only users can only view data

### Authentication
- JWT-based authentication via Supabase Auth
- Token refresh mechanism
- Role-based authorization middleware

### Audit Logging
All sensitive operations are logged:
- User logins/logouts
- Client CRUD operations
- Voucher creation/updates/cancellation
- Consent capture
- Data exports
- User role changes

## 🎯 Key Business Rules

### Repeat Voucher Logic
- System checks if client has received ≥3 vouchers in the last 6 months
- If true, staff must:
  - Select a repeat voucher reason
  - Provide explanatory notes
  - Capture explicit consent

### Consent Management
- **Contact Consent**: Required to store phone/email
- **Dietary Consent**: Required to store dietary requirements
- If consent is revoked, sensitive data is automatically deleted

### Multi-Centre Support
- Staff assigned to specific centres
- Data visibility respects centre assignments
- Super admins see all centres

## 📝 Development Notes

### Implementing Remaining Controllers

Several controllers are stubbed and need full implementation. Follow the pattern in `client.controller.js`:

1. Inject required services in constructor
2. Handle errors with try-catch and next()
3. Log audit trails for sensitive operations
4. Validate input data
5. Return appropriate HTTP status codes

### Adding New Features

1. Update database schema in `schema.sql`
2. Create/update service with business logic
3. Create/update controller
4. Define routes
5. Add audit logging if needed
6. Update this README

### Testing

(Tests to be implemented)
```bash
npm test
```

## 🐛 Troubleshooting

### Database Connection Issues
- Verify Supabase URL and keys in `.env`
- Check Supabase project status in dashboard

### RLS Policy Issues
- Ensure user has a record in `users` table
- Check user has centre assignments
- Verify user role is correct

### Audit Logs Not Created
- Check `supabaseAdmin` client is used
- Verify audit service doesn't throw errors

## 📄 License

UNLICENSED - Proprietary software for City of God Foodbank

## 👥 Authors

City of God Foodbank Development Team

## 📞 Support

For technical support, contact: dev@foodbank.org
