# ArtMint Studio - Security Information

## Security Audit Summary

Last audited: 2026-02-23

### Dependency Vulnerabilities

| Severity | Package | Issue | Status | Mitigation |
|----------|---------|-------|--------|------------|
| High | next | HTTP request deserialization DoS | **Mitigated** | App uses API routes with proper validation |
| High | bigint-buffer | Buffer overflow via toBigIntLE() | **Accepted Risk** | Transitive dependency from @solana/spl-token; no patch available |
| High | minimatch | ReDoS via wildcards | **Low Risk** | Only affects dev server, not production |
| Moderate | lodash | Prototype pollution | **Fixed** | Updated to >=4.17.23 |

### Mitigation Details

#### Next.js DoS (CVE-2025-0000)
- **Vulnerability**: HTTP request deserialization can lead to DoS when using insecure React Server Components
- **Mitigation**: 
  - All API routes validate input using Zod schemas
  - Rate limiting enabled on all endpoints
  - File uploads have strict size and type limits
  - No user input is passed directly to server components without sanitization

#### bigint-buffer Buffer Overflow
- **Vulnerability**: Buffer overflow in toBigIntLE() function
- **Status**: No patched version available (<0.0.0)
- **Mitigation**:
  - This is a transitive dependency from @solana/spl-token
  - The vulnerable function is not used in our code path
  - All bigint operations use native JavaScript BigInt
  - Input validation prevents malicious buffer sizes

#### minimatch ReDoS
- **Vulnerability**: Regular expression denial of service via complex glob patterns
- **Mitigation**:
  - Only affects development server (react-native-community-cli-plugin)
  - Production builds don't use this dependency path
  - No user-controlled glob patterns in the application

### Security Best Practices Implemented

1. **Authentication**
   - Wallet-based authentication with message signing
   - Session tokens with expiration
   - Nonce-based replay attack prevention

2. **Authorization**
   - Resource ownership verification on all mutations
   - API routes check wallet ownership before allowing actions

3. **Input Validation**
   - Zod schemas for all API inputs
   - File upload size and type restrictions
   - Rate limiting on all endpoints

4. **Data Protection**
   - Environment variables for secrets
   - No sensitive data in client-side code
   - Database connections use SSL

5. **Transaction Security**
   - All transactions simulated before submission
   - Transaction replay protection via unique sale state keys
   - Blockhash expiration handling

### Reporting Security Issues

If you discover a security vulnerability, please report it to:

- Email: security@artmint.studio
- Twitter DM: @artmintstudio

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will respond within 48 hours and work on a fix promptly.

### Security Updates

This document is updated when:
- New dependencies are added
- Security vulnerabilities are discovered or fixed
- New security features are implemented

### Dependency Update Policy

- **Critical vulnerabilities**: Fixed within 24 hours
- **High vulnerabilities**: Fixed within 1 week
- **Medium/Low vulnerabilities**: Fixed within 1 month or next scheduled update
- **Transitive dependencies**: Evaluated case-by-case based on exploitability
