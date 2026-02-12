# Applications

This directory contains the application services.

## Structure

```
apps/
├── app-backend/    # Main application server (Hono + TypeScript)
├── app-frontend/   # Next.js frontend
└── auth/           # Auth service (deployed on Render)
```

## app-backend

Main application built with Hono framework.
- Clean layered architecture (adapters, repositories, services)
- Dependency injection via Awilix
- PostgreSQL support
- JWT authentication
- Prometheus metrics

## app-frontend

Next.js frontend application.
- React 19 with App Router
- Tailwind CSS styling
- Zustand state management

## auth

Authentication service with Cognito integration.
- JWT token generation/validation
- **Deployed on Render:** https://your-auth-gateway.example.com
