# Email Templates

This directory contains email templates using the doT.js templating engine with a layout system to avoid code duplication.

## Template Structure

Templates are stored in the `templates/` directory with the following naming convention:
- `{template-name}.html.dot` - HTML version of the template
- `{template-name}.text.dot` - Plain text version of the template
- `layout.html.dot` - Base HTML layout (shared across all templates)
- `layout.text.dot` - Base text layout (shared across all templates)

Both HTML and text versions are optional, but it's recommended to provide both for better email client compatibility.

## Layout System

All templates automatically use the `layout.html.dot` and `layout.text.dot` base templates, which provide:
- Consistent header with API logo
- Standardized styling and structure
- Footer with contact information

Content templates only need to define their specific content - the layout wraps it automatically. The layout uses `{{=it.content}}` to insert the rendered template content.

## Available Templates

- **welcome** - Welcome email for new users
- **invitation** - Team/organization invitation email
- **password-reset** - Password reset request email

## Usage

### In Services

```typescript
import { sendTemplatedEmail } from '../utils/email-templates'

// Send a welcome email
await sendTemplatedEmail(
  'user@example.com',
  'welcome',
  {
    name: 'John Doe',
    email: 'user@example.com',
    activationLink: 'https://app.example.com/activate?token=...'
  },
  app
)

// Send with custom subject
await sendTemplatedEmail(
  'user@example.com',
  'invitation',
  {
    inviterName: 'Jane Smith',
    organizationName: 'Acme Medical',
    role: 'Provider',
    invitationLink: 'https://app.example.com/invite?token=...',
    expiresAt: '2024-12-31'
  },
  app,
  {
    subject: 'You\'ve been invited to join Acme Medical'
  }
)
```

### Rendering Templates Without Sending

```typescript
import { renderTemplate, renderTemplatePair } from '../utils/email-templates'

// Render HTML only
const html = renderTemplate('welcome.html', { name: 'John' })

// Render both HTML and text
const { html, text } = renderTemplatePair('welcome', { name: 'John' })
```

## Creating New Templates

1. Create two files in the `templates/` directory:
   - `{template-name}.html.dot` - HTML version (content only, no HTML structure)
   - `{template-name}.text.dot` - Plain text version (content only)

2. **Important**: Content templates should only contain the content, not the full HTML structure. The layout will automatically wrap your content.

   Example `welcome.html.dot`:
   ```html
   <h1>Welcome{{? it.name }}, {{=it.name}}{{?}}!</h1>
   
   <div class="content">
     <p>Thank you for joining API.</p>
     {{? it.activationLink}}
     <p style="text-align: center;">
       <a href="{{=it.activationLink}}" class="button">Activate Account</a>
     </p>
     {{?}}
   </div>
   ```

   Example `welcome.text.dot`:
   ```
   Welcome{{? it.name }}, {{=it.name}}{{?}}!
   
   Thank you for joining API.
   
   {{? it.activationLink}}
   Activate your account: {{=it.activationLink}}
   {{?}}
   ```

3. Use doT.js syntax for templating:
   ```html
   <h1>Hello{{? it.name }}, {{=it.name}}{{?}}!</h1>
   {{? it.items}}
   <ul>
     {{~it.items :item}}
     <li>{{=item.name}}</li>
     {{~}}
   </ul>
   {{?}}
   ```

4. Templates are automatically loaded on app startup and cached for performance.

5. To disable the layout for a specific template (not recommended), pass `useLayout: false` in the options:
   ```typescript
   await sendTemplatedEmail(
     'user@example.com',
     'custom-template',
     { ... },
     app,
     { useLayout: false }
   )
   ```

## doT.js Syntax Reference

- `{{=it.variable}}` - Output variable value (HTML escaped)
- `{{!it.variable}}` - Output variable value (raw HTML, use with caution)
- `{{?it.condition}}...{{?}}` - If condition
- `{{?it.condition}}...{{??}}...{{?}}` - If/else condition
- `{{~it.array :item}}...{{~}}` - Loop through array
- `{{#def.snippet}}` - Include snippet/partial

For more details, see: https://github.com/olado/doT

## Template Data

Common template variables:
- `name` - User's name
- `email` - User's email
- `organizationName` - Organization name
- `inviterName` - Name of person sending invitation
- `role` - User role
- `activationLink` - Account activation link
- `invitationLink` - Invitation acceptance link
- `resetLink` - Password reset link
- `expiresAt` - Expiration date/time
- `subject` - Email subject (optional, can override in sendTemplatedEmail)

## Testing Templates

Templates are automatically loaded when the app starts. To test a template:

```typescript
import { renderTemplatePair } from '../utils/email-templates'

const { html, text } = renderTemplatePair('welcome', {
  name: 'Test User',
  email: 'test@example.com'
})

console.log('HTML:', html)
console.log('Text:', text)
```

