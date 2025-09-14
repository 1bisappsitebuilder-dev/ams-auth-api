# Docker Setup Guide for LMS API

This guide explains how to use the Docker configuration for the LMS API project.

## Files Created

1. **Dockerfile** - Multi-stage Docker build for production and development
2. **docker-compose.yml** - Orchestration for all services
3. **nginx.conf** - Reverse proxy configuration
4. **.dockerignore** - Optimizes build context

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL="postgresql://lms_user:lms_password@localhost:5432/lms_db"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-here"

# CORS Configuration
CORS_ORIGINS="http://localhost:3000,http://localhost:3001"

# Application Configuration
NODE_ENV="development"
PORT=3000

# Database Configuration (for local Docker setup)
POSTGRES_DB="lms_db"
POSTGRES_USER="lms_user"
POSTGRES_PASSWORD="lms_password"

# Cloudinary Configuration (if using)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# TTLock Configuration (if using)
TTLOCK_CLIENT_ID="your-ttlock-client-id"
TTLOCK_CLIENT_SECRET="your-ttlock-client-secret"
TTLOCK_SERVER_URL="https://euapi.ttlock.com"

# Logging Configuration
LOG_LEVEL="info"
```

## Usage Commands

### Production Setup

```bash
# Build and run production service
docker-compose up app

# Build and run with nginx reverse proxy
docker-compose --profile production up
```

### Development Setup

```bash
# Run development service with hot reload
docker-compose --profile dev up app-dev

# Run with local database
docker-compose --profile dev --profile local-db up

# Run Prisma Studio for database management
docker-compose --profile prisma up prisma-studio
```

### Database Operations

```bash
# Run database migrations
docker-compose exec app npx prisma migrate deploy

# Seed the database
docker-compose exec app npx prisma db seed

# Reset database
docker-compose exec app npx prisma migrate reset --force
```

### Building Images

```bash
# Build production image
docker build --target runner -t lms-api:prod .

# Build development image
docker build --target builder -t lms-api:dev .
```

## Service Profiles

- **Default**: Production app only
- **dev**: Development app with hot reload
- **local-db**: Includes PostgreSQL database
- **prisma**: Includes Prisma Studio
- **production**: Includes nginx reverse proxy

## Health Checks

The application includes health checks that monitor:

- Application availability on port 3000
- Health endpoint response
- Container resource usage

## Volumes

- `./logs:/app/logs` - Application logs
- `./assets:/app/assets` - Static assets
- `postgres_data:/var/lib/postgresql/data` - Database persistence

## Network

All services run on the `lms-network` bridge network for secure communication.

## Security Features

- Non-root user execution
- Resource limits and reservations
- Health checks for monitoring
- Secure environment variable handling

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000, 3001, 5432, 5555, 80, 443 are available
2. **Permission issues**: Check file ownership for mounted volumes
3. **Database connection**: Verify DATABASE_URL environment variable
4. **Build failures**: Check .dockerignore and ensure all required files are present

### Logs

```bash
# View application logs
docker-compose logs app

# View development logs
docker-compose logs app-dev

# Follow logs in real-time
docker-compose logs -f app
```

### Cleanup

```bash
# Stop all services
docker-compose down

# Remove volumes
docker-compose down -v

# Remove images
docker-compose down --rmi all
```
