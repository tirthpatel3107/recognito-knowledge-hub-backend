# Backend Setup Guide

## Quick Start

1. **Create `.env` file** (if not already created):
   ```bash
   cp .env.example .env
   ```

2. **Set LOGIN_SPREADSHEET_ID** in your `.env` file:
   - This is the only environment variable required
   - See section 3 below for how to get the spreadsheet ID

3. **Set up the Config sheet** in your Google Spreadsheet:
   - ⚠️ **IMPORTANT**: The backend loads configuration from a "Config" sheet in your Google Spreadsheet
   - See [CONFIG_SHEET_SETUP.md](./CONFIG_SHEET_SETUP.md) for detailed instructions
   - You must add `JWT_SECRET` and other configuration keys to the Config sheet

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Start the server**:
   ```bash
   npm run dev
   ```

## Important: Configuration Storage

⚠️ **The backend loads configuration from a Google Sheet, not from `.env` file!**

- The **only** environment variable required is `LOGIN_SPREADSHEET_ID` (in `.env` file)
- All other configuration (JWT_SECRET, API keys, spreadsheet IDs, etc.) is stored in a **Config sheet** in your Google Spreadsheet
- The Config sheet is automatically loaded when users log in with Google OAuth

**👉 See [CONFIG_SHEET_SETUP.md](./CONFIG_SHEET_SETUP.md) for complete instructions on setting up the Config sheet.**

## Environment Variables Guide

### Required: LOGIN_SPREADSHEET_ID

The only environment variable that must be set in your `.env` file is:

```
LOGIN_SPREADSHEET_ID=your-spreadsheet-id-here
```

This should be the ID of the Google Spreadsheet that contains:
- Your `UserDetail` sheet (with user emails and passwords)
- Your `Config` sheet (with all backend configuration)

### 2. Config Sheet Setup (REQUIRED)

**⚠️ You must set up the Config sheet before the backend will work properly.**

1. Open your Google Spreadsheet (the one with `LOGIN_SPREADSHEET_ID`)
2. Create a new sheet named "Config" (exact name, case-sensitive)
3. Add configuration keys and values (see [CONFIG_SHEET_SETUP.md](./CONFIG_SHEET_SETUP.md) for details)

**Required keys in Config sheet:**
- `JWT_SECRET` - Generate using one of the methods below
- `GOOGLE_API_KEY` - Your Google API key
- `GOOGLE_CLIENT_ID` - Your OAuth 2.0 Client ID
- `GOOGLE_CLIENT_SECRET` - Your OAuth 2.0 Client Secret
- (And other configuration keys - see the full guide)

**Generate JWT Secret:**

**Option 1: Using OpenSSL**
```bash
openssl rand -base64 32
```

**Option 2: Using Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Option 3: Using PowerShell (Windows)**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Copy the output and paste it into the `JWT_SECRET` row in your Config sheet.

### Get Google API Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google Sheets API
   - Google Docs API
   - Google OAuth2 API
4. Create credentials:
   - **API Key**: Go to "Credentials" > "Create Credentials" > "API Key"
     - Under "API restrictions": Restrict to "Google Sheets API" and "Google Docs API"
     - Under "Application restrictions": **IMPORTANT** - Set to "None" (for server-side usage)
       - Server-side applications don't send HTTP referrers, so referrer-based restrictions will fail
       - For production, consider using "IP addresses" restriction for better security
   - **OAuth 2.0 Client ID**: Go to "Credentials" > "Create Credentials" > "OAuth client ID"
     - Application type: Web application
     - Authorized redirect URIs: 
       - Local: `http://localhost:3001/api/auth/google/callback`
       - Production: `https://your-backend-url.onrender.com/api/auth/google/callback`
   - **Client Secret**: Generated when you create the OAuth 2.0 Client ID
   
   **Note**: If you get "Requests from referer <empty> are blocked" errors, see [AUTHENTICATION_FIX.md](./AUTHENTICATION_FIX.md) for troubleshooting.

5. Add these credentials to your **Config sheet** (not `.env` file):
   - `GOOGLE_API_KEY`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`

### Get Spreadsheet IDs

1. Open your Google Sheets
2. Look at the URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`
3. Copy the `SPREADSHEET_ID` part (the long string between `/d/` and `/edit`)
4. Add to your **Config sheet** (not `.env` file):

**Required Spreadsheet IDs (add to Config sheet):**
- `QUESTION_BANK_SPREADSHEET_ID` - Contains technologies and questions
- `PRACTICAL_TASKS_SPREADSHEET_ID` - Contains practical tasks
- `WORK_SUMMARY_SPREADSHEET_ID` - Contains work summaries
- `PROJECT_LISTING_SPREADSHEET_ID` - Contains project listings

**Note:** `LOGIN_SPREADSHEET_ID` goes in your `.env` file (not Config sheet), as it's needed to find the Config sheet.

### Get Google Docs Document IDs

1. Open your Google Docs
2. Look at the URL: `https://docs.google.com/document/d/{DOC_ID}/edit`
3. Copy the `DOC_ID` part
4. Add to your **Config sheet** (not `.env` file):

**Required Document IDs (add to Config sheet):**
- `TODO_DOC_ID` - Todo document
- `CREDENTIAL_DOC_ID` - Credentials document
- `WORK_SUMMARY_DOC_ID` - Work summary document
- `PROJECT_DOC_ID` - Project document

### Configure CORS (Frontend URL)

Add `FRONTEND_URL` to your **Config sheet**:

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
- **Config sheet security**: The Config sheet contains sensitive information (JWT_SECRET, API keys, etc.)
  - Ensure the Config sheet is **NOT publicly accessible**
  - Only share it with trusted Google accounts
  - The sheet is accessed using OAuth tokens, so only authenticated users can read it
- Use strong, random `JWT_SECRET` in production
- Restrict Google API Key to specific APIs
- Keep OAuth Client Secret secure
- Update `GOOGLE_REDIRECT_URI` when deploying to production

## Troubleshooting

### Error: "JWT secret is not configured in the Config sheet"
- **Cause**: The `JWT_SECRET` key is missing or empty in the Config sheet
- **Solution**: 
  1. Open your Google Spreadsheet (with `LOGIN_SPREADSHEET_ID`)
  2. Go to the "Config" sheet
  3. Add a row with `JWT_SECRET` in column A and your generated secret in column B
  4. Make sure the sheet is named exactly "Config" (case-sensitive)
  5. Restart your backend server and log in again

See [CONFIG_SHEET_SETUP.md](./CONFIG_SHEET_SETUP.md) for more troubleshooting tips.

### Server won't start
- Check that `LOGIN_SPREADSHEET_ID` is set in `.env` file
- Verify port 3001 is not in use: `netstat -ano | findstr :3001`
- Make sure the Config sheet exists and is accessible

### Google API errors
- Verify API keys are correct in the Config sheet
- Check that required APIs are enabled in Google Cloud Console
- Ensure spreadsheets/documents are accessible with the API key
- Verify the user has read access to the Config sheet

### CORS errors
- Verify `FRONTEND_URL` in Config sheet matches your frontend URL exactly (including protocol and port)

## Next Steps

Once your backend is running:
1. Update frontend `.env` with `VITE_API_BASE_URL=http://localhost:3001/api`
2. Start your frontend application
3. Test the full integration

For production deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md)
