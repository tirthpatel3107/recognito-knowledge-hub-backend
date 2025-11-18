# Security Documentation

## Security Improvements Implemented

### 1. Rate Limiting
- **API Rate Limiter**: 100 requests per 15 minutes per IP
- **Auth Rate Limiter**: 5 requests per 15 minutes per IP (prevents brute force)
- **Write Rate Limiter**: 50 requests per 15 minutes per IP

### 2. Security Headers
- **Content Security Policy (CSP)**: Restricts resource loading to prevent XSS
- **HTTP Strict Transport Security (HSTS)**: Forces HTTPS connections
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-XSS-Protection**: Legacy XSS protection
- **Referrer-Policy**: Controls referrer information
- **Permissions-Policy**: Restricts browser features

### 3. Input Validation
- All user inputs are validated and sanitized
- Email validation with normalization
- Password strength requirements
- String length limits
- Character whitelisting for names/tags
- URL validation for images

### 4. httpOnly Cookies
- JWT tokens are stored in httpOnly cookies (prevents XSS access)
- Cookies use `sameSite: strict` for CSRF protection
- Secure flag enabled in production (HTTPS only)

## Security Considerations

### OAuth Scope Limitations

**⚠️ IMPORTANT**: The current OAuth implementation requests broad scopes:
- `https://www.googleapis.com/auth/spreadsheets` - Full access to ALL spreadsheets
- `https://www.googleapis.com/auth/documents` - Full access to ALL Google Docs

**Risk**: If a user's OAuth token is compromised, an attacker could access ALL of their Google Sheets and Docs, not just the application's spreadsheets.

**Recommendations**:
1. **Use Service Accounts**: For backend operations, use Google Service Accounts with limited access to specific spreadsheets
2. **Restrict Spreadsheet Sharing**: Ensure spreadsheets are only shared with necessary accounts
3. **Monitor Token Usage**: Implement logging to detect unusual access patterns
4. **Token Expiration**: Tokens expire after 24 hours, but consider shorter lifetimes for sensitive operations
5. **Scope Reduction**: Consider using file-specific permissions if Google adds support

### API Key Exposure

**Current Issue**: The Google API key is exposed in the frontend bundle.

**Mitigation**:
- API key should be restricted in Google Cloud Console to specific domains/IPs
- Consider moving all Google API calls to backend proxy endpoints
- Use API key restrictions: HTTP referrers, IP addresses, Android apps, iOS apps

### Token Storage

**Current Implementation**:
- JWT tokens: Stored in httpOnly cookies (secure) + localStorage (for backward compatibility)
- Google OAuth tokens: Stored in localStorage (vulnerable to XSS)

**Recommendations**:
1. Migrate Google OAuth tokens to httpOnly cookies or sessionStorage
2. Remove localStorage token storage once cookie-based auth is fully implemented
3. Implement token refresh mechanism to reduce token lifetime

### Best Practices

1. **Environment Variables**: Never commit `.env` files or hardcode secrets
2. **HTTPS**: Always use HTTPS in production
3. **Regular Updates**: Keep dependencies updated (`npm audit`)
4. **Monitoring**: Monitor for suspicious activity and rate limit violations
5. **Backup**: Regularly backup Google Sheets data
6. **Access Control**: Limit spreadsheet sharing to necessary users only

## Security Checklist

- [x] Rate limiting implemented
- [x] Security headers configured
- [x] Input validation added
- [x] httpOnly cookies for JWT
- [ ] Google OAuth tokens in httpOnly cookies (TODO)
- [ ] Backend proxy for all Google API calls (TODO)
- [ ] Token refresh mechanism (TODO)
- [ ] Service account for backend operations (TODO)
- [ ] API key restrictions in Google Cloud Console (Manual)

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:
1. Do not create a public GitHub issue
2. Contact the maintainers directly
3. Provide detailed information about the vulnerability
4. Allow time for the issue to be addressed before public disclosure

