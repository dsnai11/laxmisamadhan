# IT Ticketing Portal - Enterprise Edition

A comprehensive, enterprise-grade IT ticketing system with three specialized departments:
- **IT Hardware** - Hardware requests, repairs, replacements
- **IT Software** - Software installations, licenses, issues
- **Digital Security** - Security incidents, access requests, compliance
- **AI** - AI model requests, data requests, ML operations

## Features

### Core Features
- **Multi-Portal Architecture**: Admin Portal, Agent/Technician Portal, Ticket Raiser Portal
- **Advanced Ticket Management**: Full lifecycle, SLA tracking, escalations, approvals
- **Role-Based Access Control**: Super Admin, Admin, Dept Head, Team Lead, Agent, Raiser, Viewer
- **Multi-Factor Authentication**: TOTP with backup codes
- **Real-time Notifications**: WebSocket-powered live updates
- **Knowledge Base**: Articles, categories, search, ratings
- **Asset Management**: Hardware/software tracking, assignments
- **Custom Fields**: Dynamic forms per department/category
- **Reporting & Analytics**: Dashboards, SLA compliance, agent performance

### Security
- JWT access/refresh tokens with rotation
- Bcrypt password hashing (12 rounds)
- AES-256-GCM encryption for sensitive data
- Rate limiting, helmet, CORS, input validation
- Audit logging for all critical operations
- Session management with revocation

### Departments
| Department | Type | Color | Focus |
|------------|------|-------|-------|
| IT Hardware | IT_HARDWARE | Blue | Laptops, monitors, peripherals |
| IT Software | IT_SOFTWARE | Purple | Licenses, installations, SaaS |
| Digital Security | DIGITAL_SECURITY | Red | Incidents, access, compliance |
| AI | AI | Amber | Models, data, ML ops |

## Quick Start (LAN Deployment)

### Prerequisites
- Docker 24+ and Docker Compose 2+
- 4GB+ RAM available
- Ports 80, 443, 3000, 3001, 5173, 5432, 6379 available

### Windows (PowerShell)
```powershell
# Clone and navigate
git clone <repo> ticket-portal
cd ticket-portal

# Deploy to LAN (auto-detects IP)
.\deploy-lan.ps1

# Or specify IP manually
.\deploy-lan.ps1 -LanIp "192.168.1.100"

# With custom domain and SSL
.\deploy-lan.ps1 -LanIp "192.168.1.100" -Domain "tickets.company.local" -Ssl
```

### Linux/macOS (Bash)
```bash
# Clone and navigate
git clone <repo> ticket-portal
cd ticket-portal

# Make script executable
chmod +x deploy-lan.sh

# Deploy to LAN (auto-detects IP)
./deploy-lan.sh

# Or specify IP manually
./deploy-lan.sh 192.168.1.100

# With custom domain
./deploy-lan.sh 192.168.1.100 tickets.company.local --ssl
```

### Manual Docker Compose
```bash
# Copy and configure environment
cp .env.production.example .env.production
# Edit .env.production with your values

# Build and start
docker-compose up -d --build

# Run migrations
docker exec ticket-portal-backend npx prisma migrate deploy

# Seed data (optional)
docker exec ticket-portal-backend npx prisma db seed
```

## Access Points

After deployment:
- **Frontend**: `http://<LAN_IP>:5173` (or your domain)
- **API**: `http://<LAN_IP>:3000/api/v1`
- **WebSocket**: `http://<LAN_IP>:3001`
- **Database**: `postgresql://postgres:<password>@<LAN_IP>:5432/ticket_portal`

## Default Admin Account

On first run, a super admin is created:
- **Email**: `admin@ticketportal.local`
- **Password**: Check backend logs: `docker logs ticket-portal-backend | grep "Temporary Password"`

## Configuration

### Environment Variables (.env.production)
```bash
# Database
DB_PASSWORD=secure_password

# JWT (generate with: openssl rand -base64 32)
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# Encryption (32 chars)
ENCRYPTION_KEY=your_32_char_key

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=noreply@yourdomain.com

# Frontend URL (your LAN IP or domain)
FRONTEND_URL=http://192.168.1.100:5173
```

### SSL/HTTPS Setup
1. Place certificates in `./ssl/`:
   - `cert.pem` - Certificate
   - `key.pem` - Private key
2. Update `nginx/nginx.conf` for HTTPS
3. Run with `--ssl` flag: `./deploy-lan.sh <IP> <domain> --ssl`

## Development

### Backend
```bash
cd backend
cp .env.example .env
# Edit .env
npm install
npx prisma migrate dev
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Database Management
```bash
# Open Prisma Studio
cd backend && npx prisma studio

# Reset database
cd backend && npx prisma migrate reset

# Generate client after schema changes
cd backend && npx prisma generate
```

## API Documentation

Base URL: `http://<LAN_IP>:3000/api/v1`

### Authentication
```
POST   /auth/register          Register new user
POST   /auth/login             Login
POST   /auth/refresh           Refresh tokens
POST   /auth/logout            Logout
POST   /auth/forgot-password   Request password reset
POST   /auth/reset-password    Reset password
POST   /auth/change-password   Change password
POST   /auth/mfa/setup         Setup MFA
POST   /auth/mfa/verify        Verify MFA
POST   /auth/mfa/disable       Disable MFA
GET    /auth/me                Get current user
```

### Tickets
```
GET    /tickets                List tickets (with filters)
POST   /tickets                Create ticket
GET    /tickets/:id            Get ticket details
PATCH  /tickets/:id            Update ticket
POST   /tickets/:id/assign     Assign ticket
PATCH  /tickets/:id/status     Update status
POST   /tickets/:id/comments   Add comment
POST   /tickets/:id/watchers   Add watcher
POST   /tickets/bulk           Bulk actions
```

### Users (Admin)
```
GET    /users                  List users
POST   /users                  Create user
GET    /users/:id              Get user
PATCH  /users/:id              Update user
PATCH  /users/:id/role         Change role
PATCH  /users/:id/status       Change status
DELETE /users/:id              Delete user
```

### Reports
```
GET    /reports/dashboard      Dashboard statistics
GET    /reports/agents/performance  Agent performance
GET    /reports/departments    Department reports
GET    /reports/sla            SLA compliance
GET    /reports/tickets/trend  Ticket volume trend
GET    /reports/export         Export tickets (CSV/JSON)
```

## Project Structure

```
ticket-portal/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── config/         # Configuration
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Auth, validation, errors
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Helpers, JWT, encryption
│   │   ├── validators/     # Zod schemas
│   │   └── index.ts        # Entry point
│   ├── prisma/
│   │   └── schema.prisma   # Database schema
│   └── Dockerfile
├── frontend/               # React/TypeScript SPA
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── context/        # React contexts (Auth, Socket)
│   │   ├── hooks/          # Custom hooks
│   │   ├── pages/          # Page components
│   │   ├── services/       # API client
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Helpers
│   ├── nginx/              # Nginx config
│   └── Dockerfile
├── docker-compose.yml      # Full stack orchestration
├── deploy-lan.ps1         # Windows deployment
├── deploy-lan.sh          # Linux/macOS deployment
└── .env.production.example # Environment template
```

## Default Ports

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5173 | React app (dev) / 80 (prod) |
| Backend API | 3000 | REST API |
| WebSocket | 3001 | Real-time updates |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Caching/sessions |
| Nginx | 80/443 | Reverse proxy |

## License

MIT License - See LICENSE file for details

## Support

For issues and feature requests, please use the GitHub issue tracker.