# Deploying Backend to Render.com

This guide walks you through deploying the Recognito Knowledge Hub backend to Render.com.

## Prerequisites

1. A Render.com account (sign up at https://dashboard.render.com/)
2. Your backend code pushed to a Git repository (GitHub, GitLab, or Bitbucket)
3. All required environment variables ready

## Step-by-Step Deployment

### 1. Create a New Web Service

1. Log in to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** button
3. Select **"Web Service"**
4. Connect your repository:
   - If first time: Click **"Connect account"** and authorize Render
   - Select your Git provider (GitHub/GitLab/Bitbucket)
   - Choose the repository containing `recognito-knowledge-hub-backend`

### 2. Configure the Service

Fill in the service configuration:

- **Name**: `recognito-knowledge-hub-backend` (or your preferred name)
- **Environment**: Select **"Node"**
- **Region**: Choose closest to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: Leave empty (backend is at root) or specify `recognito-knowledge-hub-backend` if in subdirectory

### 3. Build & Start Commands

- **Build Command**: `npm install`
- **Start Command**: `node src/index.js`

If using Node.js watch mode for development, use:
- **Start Command**: `npm start` (uses `node src/index.js` from package.json)

### 4. Configure Environment Variables

Click **"Environment"** tab and add all required variables:

```env
# Server Configuration
NODE_ENV=production
PORT=10000
JWT_SECRET=your_secure_jwt_secret_here_minimum_32_characters

# Google API Configuration
GOOGLE_API_KEY=your_google_api_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-backend-url.onrender.com/api/auth/google/callback

# Spreadsheet IDs
LOGIN_SPREADSHEET_ID=your_login_spreadsheet_id
QUESTION_BANK_SPREADSHEET_ID=your_question_bank_spreadsheet_id
PRACTICAL_TASKS_SPREADSHEET_ID=your_practical_tasks_spreadsheet_id
WORK_SUMMARY_SPREADSHEET_ID=your_work_summary_spreadsheet_id
PROJECT_LISTING_SPREADSHEET_ID=your_project_listing_spreadsheet_id

# Google Docs Document IDs
TODO_DOC_ID=your_todo_document_id
CREDENTIAL_DOC_ID=your_credential_document_id
WORK_SUMMARY_DOC_ID=your_work_summary_document_id
PROJECT_DOC_ID=your_project_document_id

# CORS Configuration
FRONTEND_URL=https://recognito-git-main-tirthpatel3107s-projects.vercel.app
```

**Important Notes:**
- Use a strong, random `JWT_SECRET` (generate with: `openssl rand -base64 32`)
- Update `GOOGLE_REDIRECT_URI` to your Render backend URL after deployment
- Update `FRONTEND_URL` to your frontend deployment URL
- Render provides port `10000` by default, or use `PORT` env var

### 5. Advanced Settings (Optional)

#### Auto-Deploy
- Enable **"Auto-Deploy"** to automatically deploy on every push to the branch

#### Health Check Path
- Add a health check: `/health` (matches your health endpoint)

#### Instance Type
- **Free tier**: 512MB RAM, sleeps after 15 min inactivity
- **Starter**: $7/month - Always on, better for production

### 6. Deploy

1. Click **"Create Web Service"**
2. Render will:
   - Clone your repository
   - Run `npm install`
   - Start the service with `node src/index.js`
3. Watch the build logs for any errors
4. Once deployed, you'll get a URL like: `https://recognito-knowledge-hub-backend.onrender.com`

### 7. Update Google OAuth Redirect URI

After deployment, update your Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Credentials**
3. Edit your OAuth 2.0 Client ID
4. Add your Render backend URL to **Authorized redirect URIs**:
   ```
   https://your-backend-url.onrender.com/api/auth/google/callback
   ```
5. Save changes

### 8. Update Frontend Configuration

Update your frontend `.env` file (or environment variables in your frontend deployment):

```env
VITE_API_BASE_URL=https://your-backend-url.onrender.com/api
```

## Troubleshooting

### Service Keeps Sleeping (Free Tier)

- Free tier services sleep after 15 minutes of inactivity
- First request after sleep takes ~30 seconds (cold start)
- Consider upgrading to Starter plan for production

### Build Failures

Check build logs for:
- Missing environment variables
- Node version issues
- Missing dependencies

### CORS Errors

Ensure `FRONTEND_URL` environment variable matches your frontend domain exactly (including protocol).

### Database/Connection Issues

- Ensure all Google API credentials are correct
- Verify spreadsheet IDs are correct
- Check Google API quotas haven't been exceeded

## Production Checklist

- [ ] All environment variables configured
- [ ] Google OAuth redirect URI updated
- [ ] CORS frontend URL configured
- [ ] Health check endpoint working (`/health`)
- [ ] Frontend API URL updated
- [ ] Monitoring/logging set up (optional)
- [ ] SSL certificate active (automatic on Render)

## Render CLI (Alternative)

You can also deploy using Render CLI:

```bash
# Install Render CLI
npm install -g render-cli

# Login
render login

# Deploy
render deploy
```

## Support

- [Render Documentation](https://render.com/docs)
- [Render Status Page](https://status.render.com/)
- [Render Community](https://community.render.com/)
