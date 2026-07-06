# Verifications Service

A multipurpose service for managing link-based verification codes for magic-link logins, password resets, and team invitations.

## Features

- **Multiple Verification Types**: Supports `magic-link`, `password-reset`, and `invite`
- **Automatic Email Sending**: Sends templated emails when verifications are created
- **Secure Token Generation**: Uses cryptographically secure random tokens
- **Expiration Management**: Automatic expiration tracking and validation
- **Usage Tracking**: Marks verifications as used to prevent reuse

## Schema

```typescript
{
  _id: ObjectId,
  type: 'magic-link' | 'password-reset' | 'invite',
  token: string, // Secure 64-character hex token
  email: string, // Email address for the verification
  userId?: ObjectId, // Optional user ID if user exists
  expiresAt: number, // Unix timestamp when verification expires
  used: boolean, // Whether the verification has been used
  usedAt?: number, // Unix timestamp when verification was used
  metadata?: Record<string, any>, // Additional data (e.g., organizationId, role, etc.)
  createdAt?: number, // Unix timestamp when created
  updatedAt?: number // Unix timestamp when updated
}
```

## Usage Examples

### 1. Magic Link Login

```typescript
// Create a magic link verification
const verification = await app.service('verifications').create({
  type: 'magic-link',
  email: 'user@example.com',
  expiresIn: 60 * 60 * 1000 // 1 hour (optional, defaults to 1 hour)
})

// The email is automatically sent with a sign-in link
// User clicks link, which should call verifyToken utility
```

### 2. Password Reset

```typescript
// Create a password reset verification
const verification = await app.service('verifications').create({
  type: 'password-reset',
  email: 'user@example.com',
  userId: user._id, // Optional: if user exists
  expiresIn: 60 * 60 * 1000 // 1 hour
})

// The email is automatically sent with a reset link
```

### 3. Team Invitation

```typescript
// Create an invitation verification
const verification = await app.service('verifications').create({
  type: 'invite',
  email: 'newuser@example.com',
  expiresIn: 7 * 24 * 60 * 60 * 1000, // 7 days
  metadata: {
    inviterName: 'John Doe',
    organizationName: 'Acme Medical',
    role: 'Provider',
    organizationId: 'org_1234567890'
  }
})

// The email is automatically sent with an invitation link
```

## Utility Functions

### Verify Token

```typescript
import { verifyToken } from './services/verifications/verifications.utils'

// Verify a token (checks expiration and usage)
const verification = await verifyToken(app, token, 'magic-link')

if (!verification) {
  // Token is invalid, expired, or already used
  throw new Error('Invalid or expired token')
}

// Use the verification
// ... perform action (login, reset password, accept invite)
// Then mark as used (or use markVerificationAsUsed hook)
```

### Build Verification Link

```typescript
import { buildVerificationLink } from './services/verifications/verifications.utils'

const link = buildVerificationLink(app, 'magic-link', token)
// Returns: http://localhost:5173/auth/magic-link?token=...
```

### Create Verification (Helper)

```typescript
import { createVerification } from './services/verifications/verifications.utils'

const verification = await createVerification(app, {
  type: 'magic-link',
  email: 'user@example.com',
  expiresIn: 60 * 60 * 1000
})
```

## Hooks

### `generateVerificationToken`
- **When**: Before `create`
- **What**: Generates secure token and sets expiration
- **Auto-applied**: Yes

### `sendVerificationEmail`
- **When**: After `create`
- **What**: Sends appropriate email template based on verification type
- **Auto-applied**: Yes

### `markVerificationAsUsed`
- **When**: Manual call
- **What**: Marks verification as used and sets `usedAt` timestamp
- **Usage**: Call manually after verification is consumed

## Email Templates

The service automatically uses email templates:

- **magic-link**: Uses `notification` template
- **password-reset**: Uses `password-reset` template
- **invite**: Uses `invitation` template

All templates are automatically wrapped in the layout and include:
- Appropriate subject lines
- Verification links
- Expiration information
- Branded styling

## Configuration

The service uses the app's `host` configuration to build verification links. Set this in your config:

```json
{
  "host": "https://app.example.com"
}
```

For local development, defaults to `http://localhost:5173`.

## Security Considerations

1. **Tokens are never exposed** in external API responses (handled by `verificationsExternalResolver`)
2. **Expired tokens** are automatically marked as used when verified
3. **One-time use**: Tokens should be marked as used after successful verification
4. **Secure generation**: Uses `crypto.randomBytes` for token generation

## Integration with Magic Link Strategy

The service works with the existing `MagicLinkStrategy`:

```typescript
// The strategy looks for verifications with matching token
const { data: [magicLink] } = await this.entityService.find({
  query: { token }
})
```

Make sure the `MagicLinkStrategy`'s `entityService` points to the `verifications` service.

