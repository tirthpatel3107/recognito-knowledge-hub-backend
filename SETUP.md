# Backend Setup Guide

## Quick Start

1. **Create `.env` file** (if not already created):
   ```bash
   cp .env.example .env
   ```

2. **Fill in your credentials** in the `.env` file:
   - See sections below for where to get each value

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Start the server**:
   ```bash
   npm run dev
   ```

## Environment Variables Guide

### 1. Generate JWT Secret

Generate a secure random string for `JWT_SECRET`:

**Option 1: Using OpenSSL**
```bash
openssl rand -base64 32
```

**Option 2: Using Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the output and paste it into `JWT_SECRET` in your `.env` file.

### 2. Get Google API Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google Sheets API
   - Google Docs API
   - Google OAuth2 API
4. Create credentials:
   - **API Key**: Go to "Credentials" > "Create Credentials" > "API Key"
     - Restrict it to "Google Sheets API" and "Google Docs API" for security
   - **OAuth 2.0 Client ID**: Go to "Credentials" > "Create Credentials" > "OAuth client ID"
     - Application type: Web application
     - Authorized redirect URIs: 
       - Local: `http://localhost:3001/api/auth/google/callback`
       - Production: `https://your-backend-url.onrender.com/api/auth/google/callback`
   - **Client Secret**: Generated when you create the OAuth 2.0 Client ID

5. Fill in your `.env` file:
   ```
   GOOGLE_API_KEY=your_api_key_here
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   ```

### 3. Get Spreadsheet IDs

1. Open your Google Sheets
2. Look at the URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`
3. Copy the `SPREADSHEET_ID` part (the long string between `/d/` and `/edit`)
4. Update the corresponding entry in your `.env` file

**Required Spreadsheets:**
- `LOGIN_SPREADSHEET_ID` - Contains user credentials (Email, Password)
- `QUESTION_BANK_SPREADSHEET_ID` - Contains technologies and questions
- `PRACTICAL_TASKS_SPREADSHEET_ID` - Contains practical tasks
- `WORK_SUMMARY_SPREADSHEET_ID` - Contains work summaries
- `PROJECT_LISTING_SPREADSHEET_ID` - Contains project listings

### 4. Get Google Docs Document IDs

1. Open your Google Docs
2. Look at the URL: `https://docs.google.com/document/d/{DOC_ID}/edit`
3. Copy the `DOC_ID` part
4. Update the corresponding entry in your `.env` file

**Required Documents:**
- `TODO_DOC_ID` - Todo document
- `CREDENTIAL_DOC_ID` - Credentials document
- `WORK_SUMMARY_DOC_ID` - Work summary document
- `PROJECT_DOC_ID` - Project document

### 5. Configure CORS (Frontend URL)

Set `FRONTEND_URL` to your frontend application URL:

- **Local development**: `http://localhost:5173` (default Vite port)
- **Production**: `https://your-frontend-domain.com`

## Verify Your Setup

After filling in all values, test the server:

```bash
npm run dev
```

You should see:
```
Server is running on http://localhost:3001
Environment: development
```

Test the health endpoint:
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{"status":"OK","message":"Server is running"}
```

## Security Notes

⚠️ **Important:**
- Never commit `.env` file to Git (it's already in `.gitignore`)
- Use strong, random `JWT_SECRET` in production
- Restrict Google API Key to specific APIs
- Keep OAuth Client Secret secure
- Update `GOOGLE_REDIRECT_URI` when deploying to production

## Troubleshooting

### Server won't start
- Check that all required environment variables are set
- Verify port 3001 is not in use: `netstat -ano | findstr :3001`

### Google API errors
- Verify API keys are correct
- Check that required APIs are enabled in Google Cloud Console
- Ensure spreadsheets/documents are accessible with the API key

### CORS errors
- Verify `FRONTEND_URL` matches your frontend URL exactly (including protocol and port)

## Next Steps

Once your backend is running:
1. Update frontend `.env` with `VITE_API_BASE_URL=http://localhost:3001/api`
2. Start your frontend application
3. Test the full integration

For production deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md)
