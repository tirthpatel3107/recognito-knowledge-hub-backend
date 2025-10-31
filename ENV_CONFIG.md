# Environment Configuration Guide

## Development vs Production

### Development Configuration

For local development, use these settings in your `.env`:

```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
```

### Production Configuration

For production deployment (Render.com), use these settings:

```env
NODE_ENV=production
PORT=10000  # Or use Render's PORT env var
FRONTEND_URL=https://recognito-git-main-tirthpatel3107s-projects.vercel.app
GOOGLE_REDIRECT_URI=https://your-backend-url.onrender.com/api/auth/google/callback
```

## Current Production Frontend URL

Your frontend is deployed at:
```
https://recognito-git-main-tirthpatel3107s-projects.vercel.app
```

**Important:** Make sure this URL is:
1. Added to your backend's `FRONTEND_URL` environment variable (for CORS)
2. Added to Google Cloud Console OAuth authorized origins (if using OAuth in frontend)

## Environment Variables Summary

### Required for Both Dev & Production

- `JWT_SECRET` - Must be different for each environment
- `GOOGLE_API_KEY` - Same for both
- `GOOGLE_CLIENT_ID` - Same for both
- `GOOGLE_CLIENT_SECRET` - Same for both
- All Spreadsheet IDs - Same for both
- All Document IDs - Same for both

### Environment-Specific

- `NODE_ENV` - `development` or `production`
- `PORT` - `3001` (dev) or `10000` (Render) or use `PORT` env var
- `FRONTEND_URL` - Different for dev vs production
- `GOOGLE_REDIRECT_URI` - Different for dev vs production

## Quick Switch Between Environments

You can maintain separate `.env` files:

- `.env.development` - For local development
- `.env.production` - For production (if deploying from local)

Or use environment variables directly in your deployment platform (recommended for production).

## Frontend URL Updates

When you update your frontend deployment:
1. Update `FRONTEND_URL` in backend `.env` (or deployment environment variables)
2. Ensure no trailing slash (current: `https://recognito-git-main-tirthpatel3107s-projects.vercel.app`)
3. Restart backend server for changes to take effect

## CORS Configuration

The backend uses `FRONTEND_URL` to configure CORS. Ensure:
- Protocol matches (`https://` for production, `http://` for dev)
- Domain matches exactly
- No trailing slash (backend code handles this)

Your current configuration:
- Frontend: `https://recognito-git-main-tirthpatel3107s-projects.vercel.app`
- Backend CORS: Configured to allow requests from this URL
