# Authentication Error Fix Guide

## Problem

Getting this error when trying to authenticate:
```
GaxiosError: Requests from referer <empty> are blocked.
Status: 403 Forbidden
```

## Root Cause

Your Google API key is restricted to HTTP referrers, but server-side requests don't include a referrer header. This causes Google to block the requests.

## Solution Options

You have **TWO options** to fix this:

### Option 1: Fix API Key Restrictions (Recommended for Development)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Credentials**
3. Click on your API key to edit it
4. Under **Application restrictions**, change from:
   - **Current**: "HTTP referrers (websites)"
   - **To**: Either "None" or "IP addresses"
     - For local development: Choose "None"
     - For production: Choose "IP addresses" and add your server IP
5. Click **Save**

⚠️ **Security Note**: Setting to "None" allows any server to use your API key. For production, use IP restrictions.

### Option 2: Make Spreadsheet Publicly Viewable

If you want to keep the API key restricted to HTTP referrers, make your LOGIN spreadsheet publicly readable:

1. Open your Google Sheet: `https://docs.google.com/spreadsheets/d/12M7LkqrnPlFth7A0odU-vUzpERr-j6SGTjQSPnFzQic/edit`
2. Click **Share** button
3. Under "Get link", click "Change to anyone with the link"
4. Set permission to **Viewer**
5. Copy link and click **Done**

⚠️ **Security Warning**: This makes your login spreadsheet publicly readable. Only store non-sensitive test credentials here.

### Option 3: Use Service Account (Most Secure for Production)

For production environments, consider using a Google Service Account instead of an API key:

1. Create a service account in Google Cloud Console
2. Download the JSON credentials file
3. Share your spreadsheets with the service account email
4. Update backend code to use service account authentication

See: https://cloud.google.com/docs/authentication/production

## Testing the Fix

After applying one of the fixes above:

1. Restart your backend server
2. Try logging in again
3. Check server logs for any remaining errors

## Current Code Changes

I've updated the `authenticateUser` function to:
- Support OAuth access tokens (if provided)
- Provide more helpful error messages when API key access fails
- Fallback gracefully when authentication methods fail

The updated code is in `src/services/googleSheetsService.js`.

## Next Steps

1. Choose your preferred solution above
2. Make the configuration changes in Google Cloud Console
3. Restart your backend server
4. Test the login flow

## Need Help?

If you continue to have issues:
- Check Google Cloud Console API quotas aren't exceeded
- Verify the spreadsheet ID in your `.env` file matches the actual spreadsheet
- Ensure Google Sheets API is enabled in your project
- Check server logs for detailed error messages

