
# Auth MSA - Authentication Microservice

A robust, scalable authentication and authorization microservice built with Node.js, Express, and Prisma. This service provides comprehensive user management, role-based access control, and secure authentication mechanisms for modern applications.

## 🎯 Core Objectives

- **Secure Authentication**: Implement robust JWT-based authentication with role-based access control
- **User Management**: Comprehensive user lifecycle management with profile and role assignment
- **Microservice Architecture**: Design for scalability, maintainability, and independent deployment
- **API-First Design**: RESTful API endpoints with OpenAPI/Swagger documentation
- **Database Flexibility**: Support for multiple database types through Prisma ORM

## 🚀 Key Features

### 🔐 Authentication & Authorization

- JWT token-based authentication
- Role-based access control (RBAC)
- Token verification middleware
- Secure password handling
- Session management

### 👥 User Management

- User registration and authentication
- Profile management (person details)
- Role assignment and management
- User status tracking
- Bulk operations support

### 🏗️ Microservice Architecture

- Modular service structure
- Independent service deployment
- Service-to-service communication
- Health monitoring and metrics
- Docker containerization support

### 📊 Business Logic Modules

- Facility management and availability
- Reservation and booking systems
- Pricing and rate management
- Maintenance tracking
- Organization management

### 🛠️ Developer Experience

- TypeScript support
- Comprehensive testing suite
- API documentation with Swagger/OpenAPI
- Linting and code quality tools
- Database seeding and migration scripts

## 🏗️ Architecture

```
authMSA/
├── app/                    # Application modules
│   ├── auth/              # Authentication endpoints
│   ├── user/              # User management
│   ├── role/              # Role management
│   ├── person/            # Person profile management
│   └── images/            # Image handling
├── middleware/             # Custom middleware
│   ├── verifyToken.ts     # JWT verification
│   ├── verifyRole.ts      # Role-based access control
│   └── upload.ts          # File upload handling
├── prisma/                 # Database schema and migrations
├── helper/                 # Utility services and helpers
├── utils/                  # Common utilities
└── tests/                  # Test suite
```

## 🛠️ Tech Stack

**Runtime:** Node.js with TypeScript  
**Framework:** Express.js  
**Database ORM:** Prisma  
**Database:** MongoDB (configurable)  
**Authentication:** JWT  
**Documentation:** OpenAPI/Swagger  
**Testing:** Jest  
**Containerization:** Docker  
**Validation:** Zod schemas

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MongoDB or compatible database
- Docker (optional)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/1bissolutionsdev/Templete-Auth.git
cd Templete-Auth
```

2. **Install dependencies**

```bash
npm install
```

3. **Environment Configuration**

```bash
# Copy and configure environment variables
cp .env.example .env
# Update database connection and JWT secrets
```

4. **Database Setup**

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed initial data (optional)
npm run seed
```

5. **Start the service**

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run specific test files
npm run test -- --testNamePattern="auth"
```

## 📚 API Documentation

The service includes comprehensive API documentation:

- **Swagger UI**: Available at `/api-docs` when running
- **OpenAPI Spec**: Generated in `docs/generated/`
- **Postman Collection**: Included in the repository

## 🔧 Development

### Code Quality

```bash
# Linting
npm run lint

# Format code
npm run format

# Type checking
npm run type-check
```

### Database Operations

```bash
# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name <migration-name>

# Reset database
npx prisma migrate reset

# View database
npx prisma studio
```

### Scripts

```bash
# Export OpenAPI specs
npm run export-openapi

# Apply database indexes
npm run apply-indexes

# Add reservation constraints
npm run add-reservation-constraints
```

## 🐳 Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Build image
docker build -t auth-msa .

# Run container
docker run -p 3000:3000 auth-msa
```

## 📁 Project Structure

```
├── app/                    # Application modules
├── config/                 # Configuration files
├── helper/                 # Helper services
├── middleware/             # Custom middleware
├── prisma/                 # Database schema
├── utils/                  # Utility functions
├── zod/                    # Validation schemas
├── tests/                  # Test files
├── docs/                   # API documentation
└── scripts/                # Utility scripts
```

## 🔐 Security Features

- JWT token validation
- Role-based access control
- Input validation with Zod
- Secure password handling
- CORS configuration
- Rate limiting support

## 📊 Monitoring & Metrics

- Health check endpoints
- Performance metrics
- Error logging and tracking
- Request/response logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 👥 Team

- **1BIS Solutions** - [GitHub](https://github.com/1bissolutionsdev)

## 📞 Support

For support and questions:

- Create an issue in the repository
- Contact the development team
- Check the API documentation

---

**Built with ❤️ by 1BIS Solutions**
