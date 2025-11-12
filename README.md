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
- `POST /auth/login` - Login with email/password
- `POST /auth/google/verify` - Verify Google OAuth token

### Technologies
- `GET /technologies` - Get all technologies
- `POST /technologies` - Create technology (requires Google auth)
- `PUT /technologies/:sheetId` - Update technology (requires Google auth)
- `DELETE /technologies/:sheetId` - Delete technology (requires Google auth)
- `POST /technologies/reorder` - Reorder technologies (requires Google auth)

### Questions
- `GET /questions/:technologyName` - Get questions for a technology
- `POST /questions/:technologyName` - Add question (requires Google auth)
- `PUT /questions/:technologyName/:rowIndex` - Update question (requires Google auth)
- `DELETE /questions/:technologyName/:rowIndex` - Delete question (requires Google auth)
- `POST /questions/:technologyName/reorder` - Reorder questions (requires Google auth)

### Projects
- `GET /projects` - Get all projects
- `POST /projects` - Add project (requires Google auth)
- `PUT /projects/:rowIndex` - Update project (requires Google auth)
- `DELETE /projects/:rowIndex` - Delete project (requires Google auth)
- `POST /projects/reorder` - Reorder projects (requires Google auth)

### Work Summary
- `GET /work-summary/months` - Get all month sheets
- `GET /work-summary/entries/:monthSheet` - Get entries for a month
- `POST /work-summary/months` - Create month sheet (requires Google auth)
- `POST /work-summary/entries` - Add work summary entry (requires Google auth)
- `PUT /work-summary/entries/:monthSheet/:rowIndex` - Update entry (requires Google auth)
- `DELETE /work-summary/entries/:monthSheet/:rowIndex` - Delete entry (requires Google auth)

### Practical Tasks
- `GET /practical-tasks` - Get all practical tasks

### User Preferences
- `GET /user/dashboard-order` - Get dashboard card order
- `POST /user/dashboard-order` - Save dashboard card order (requires Google auth)
- `GET /user/mode` - Get user theme mode
- `POST /user/mode` - Update user theme mode (requires Google auth)

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
