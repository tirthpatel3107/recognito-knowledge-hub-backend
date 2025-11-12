# Recognito Knowledge Hub Backend

Backend API server for Recognito Knowledge Hub application.

## Features

- RESTful API endpoints for all application operations
- Google Sheets API integration
- JWT-based authentication
- Google OAuth2 support for write operations
- Secure credential management

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

3. Configure your `.env` file with:
   - Google API credentials (API Key, Client ID, Client Secret)
   - Spreadsheet IDs
   - JWT secret
   - Frontend URL for CORS

4. Start the development server:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/google/verify` - Verify Google OAuth token

### Technologies
- `GET /api/technologies` - Get all technologies
- `POST /api/technologies` - Create technology (requires Google auth)
- `PUT /api/technologies/:sheetId` - Update technology (requires Google auth)
- `DELETE /api/technologies/:sheetId` - Delete technology (requires Google auth)
- `POST /api/technologies/reorder` - Reorder technologies (requires Google auth)

### Questions
- `GET /api/questions/:technologyName` - Get questions for a technology
- `POST /api/questions/:technologyName` - Add question (requires Google auth)
- `PUT /api/questions/:technologyName/:rowIndex` - Update question (requires Google auth)
- `DELETE /api/questions/:technologyName/:rowIndex` - Delete question (requires Google auth)
- `POST /api/questions/:technologyName/reorder` - Reorder questions (requires Google auth)

### Projects
- `GET /api/projects` - Get all projects
- `POST /api/projects` - Add project (requires Google auth)
- `PUT /api/projects/:rowIndex` - Update project (requires Google auth)
- `DELETE /api/projects/:rowIndex` - Delete project (requires Google auth)
- `POST /api/projects/reorder` - Reorder projects (requires Google auth)

### Work Summary
- `GET /api/work-summary/months` - Get all month sheets
- `GET /api/work-summary/entries/:monthSheet` - Get entries for a month
- `POST /api/work-summary/months` - Create month sheet (requires Google auth)
- `POST /api/work-summary/entries` - Add work summary entry (requires Google auth)
- `PUT /api/work-summary/entries/:monthSheet/:rowIndex` - Update entry (requires Google auth)
- `DELETE /api/work-summary/entries/:monthSheet/:rowIndex` - Delete entry (requires Google auth)

### Practical Tasks
- `GET /api/practical-tasks` - Get all practical tasks

### User Preferences
- `GET /api/user/dashboard-order` - Get dashboard card order
- `POST /api/user/dashboard-order` - Save dashboard card order (requires Google auth)
- `GET /api/user/mode` - Get user theme mode
- `POST /api/user/mode` - Update user theme mode (requires Google auth)

## Authentication

Most read operations don't require authentication. Write operations require:
1. JWT token from login endpoint (in `Authorization: Bearer <token>` header)
2. Google OAuth access token (in `Authorization: Bearer <googleToken>` header)

## Development

Run in development mode with auto-reload:
```bash
npm run dev
```

## Production

Start the server:
```bash
npm start
```

## Deployment

### Deploying to Render.com

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

Quick steps:
1. Push your code to a Git repository
2. Connect repository to Render.com dashboard
3. Create a new Web Service
4. Configure environment variables
5. Deploy!

The backend is ready to deploy to Render.com with the provided configuration files.
