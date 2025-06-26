# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability, please send an email to:
- **Email**: mbelinky@gmail.com
- **Subject**: [SECURITY] X MCP Server - [Brief Description]

Please include:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if any)

## Response Timeline

- **Initial Response**: Within 48 hours
- **Assessment**: Within 7 days
- **Fix Timeline**: Within 30 days for critical vulnerabilities

## Security Best Practices

When using this MCP server:

1. **Never commit credentials**: Keep your `.env` file out of version control
2. **Use environment variables**: Store all sensitive data in environment variables
3. **Rotate tokens regularly**: Update your Twitter/X API tokens periodically
4. **Monitor usage**: Check your Twitter Developer Dashboard for unusual activity
5. **Use OAuth 2.0**: When possible, prefer OAuth 2.0 over OAuth 1.0a

## Known Security Considerations

- **Rate Limiting**: The server implements rate limiting to prevent API abuse
- **No Data Storage**: The server does not persist any user data or credentials
- **Secure Communication**: All API calls use HTTPS
- **Token Handling**: Tokens are never logged or exposed in error messages

## Compliance

This project aims to comply with:
- Twitter/X API Terms of Service
- Anthropic's Usage Policy for MCP servers
- General security best practices for API integrations

Thank you for helping keep X MCP Server secure!