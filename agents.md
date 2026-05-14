# AGENTS.md

# Project Overview

This is a production-grade full-stack application built using:

- Next.js App Router
- TypeScript
- Next.js API Routes
- Supabase

The project must follow scalable, modular, maintainable, secure, and production-ready architecture.

---

# Core Rules

- Always use TypeScript
- Never use JavaScript unless explicitly requested
- Follow clean architecture principles
- Keep code modular and maintainable
- Avoid duplicated logic
- Prefer reusable implementations
- Use async/await
- Add proper error handling
- Never hardcode secrets
- Use environment variables
- Avoid large monolithic files
- Prefer composition over duplication
- Keep components small and focused
- Reuse utilities and components before creating new ones

---

# Next.js Rules

- Use Next.js App Router only
- Use route handlers inside `app/api`
- Prefer server components by default
- Use client components only when necessary
- Prefer server-side data fetching
- Avoid unnecessary client-side fetching
- Keep business logic outside route handlers
- Use loading.tsx and error.tsx where required
- Optimize rendering and bundle size

---

# API Rules

- Validate all inputs manually with proper type checks
- Never trust frontend validation alone
- Use proper HTTP status codes
- Wrap API handlers with try/catch
- Never expose internal errors
- Sanitize all user input
- Add proper authorization checks
- Keep API handlers thin
- Move business logic to services

Standard success response:

```json
{
  "success": true,
  "data": {},
  "message": "Success"
}
```

Standard error response:

```json
{
  "success": false,
  "error": "Something went wrong"
}
```

---

# Supabase Rules

- Always use Row Level Security (RLS)
- Never disable RLS in production
- Never expose service role key to frontend
- Use anon key only on frontend
- Use service role key only on server-side
- Validate authentication server-side
- Use typed queries
- Use migrations for schema changes
- Keep policies secure and minimal
- Use pagination for large queries

---

# Component Architecture

There are ONLY 2 types of components:

## 1. UI Components

Reusable generic presentation components.

Examples:

- Button
- Input
- Dialog
- Card
- Table
- Badge
- Select
- Textarea
- Label

Location:

```txt
src/components/ui
```

Rules:

- Must be reusable
- Must not contain business logic
- Must not contain feature-specific naming
- Must remain generic
- Must remain presentation-focused
- Must support reusable props/interfaces

GOOD:

```tsx
<Button />
<Input />
<Table />
```

BAD:

```tsx
<AddVehicleButton />
<CreateVehicleInput />
```

---

## 2. Feature / Project Components

Business/domain-specific components.

Examples:

- CreateVehicleModal
- EditDieselModal
- Dashboard
- VehicleTable
- DriverForm
- DieselEntryCard

Location:

```txt
src/components
```

Rules:

- May contain business logic
- May use hooks
- May use API calls
- May use validation
- May compose reusable UI components
- Must remain modular and maintainable

---

# Component Folder Structure

Every component must follow this structure:

```txt
componentName/
├── componentName.tsx
├── componentName.style.ts
├── componentName.types.ts
└── index.ts
```

Create additional files only when truly needed.

Optional files:

```txt
componentName.constants.ts
componentName.utils.ts
componentName.hooks.ts
```

Example UI component:

```txt
src/components/ui/button/
├── button.tsx
├── button.style.ts
├── button.types.ts
└── index.ts
```

Example feature component:

```txt
src/components/createVehicleModal/
├── createVehicleModal.tsx
├── createVehicleModal.style.ts
├── createVehicleModal.types.ts
└── index.ts
```

---

# Naming Rules — Non Negotiable

## Folder Names

Use camelCase only.

GOOD:

```txt
contractValidity
vehicleTable
createVehicleModal
```

BAD:

```txt
ContractValidity
VehicleTable
```

---

## File Names

Use camelCase only.

GOOD:

```txt
contractValidity.tsx
contractValidity.style.ts
contractValidity.types.ts
```

BAD:

```txt
ContractValidity.tsx
ContractValidity.types.ts
```

---

## React Component Names

React component exports MUST use PascalCase.

GOOD:

```tsx
export function ContractValidity() {
  return <div />;
}
```

BAD:

```tsx
export function contractValidity() {
  return <div />;
}
```

---

# Styling Rules

- Do NOT use Tailwind CSS
- Do NOT use CSS Modules
- Use `.style.ts` files only
- Use styled-components or internal styling abstractions
- Keep styling scoped per component
- Avoid inline styles
- Avoid global styles unless truly necessary
- Maintain reusable styling patterns

Example:

```txt
button.style.ts
contractValidity.style.ts
```

---

# UI Library Rules

- Build internal reusable UI components
- Do not use external component UI libraries

Not Allowed:

- Material UI
- Ant Design
- Chakra UI
- shadcn/ui
- Mantine
- Bootstrap component systems
- Tailwind component systems

Allowed:

- React
- Next.js
- styled-components

- Supabase SDK

---

# State Management Rules

- Prefer local state first
- Use Context API only when required
- Use Zustand only if global state becomes necessary
- Avoid unnecessary global state
- Prefer server-side state where possible

---

# Validation Rules

- Validate all API inputs manually with proper type and range checks
- Reuse validation helper functions
- Keep validation modular
- Never trust frontend validation alone

---

# Folder Structure

```txt
src/
├── app/
├── components/
│   ├── ui/
│   │   ├── button/
│   │   ├── input/
│   │   ├── dialog/
│   │   ├── card/
│   │   └── table/
│   │
│   ├── createVehicleModal/
│   ├── editDieselModal/
│   ├── dashboard/
│   └── contractValidity/
│
├── hooks/
├── services/
├── lib/
├── validations/
├── store/
├── types/
├── utils/
└── constants/
```

---

# Code Quality Rules

- Follow ESLint and Prettier
- Avoid `any` type unless absolutely necessary
- Use strict TypeScript
- Keep functions small and focused
- Prefer reusable utilities
- Avoid deeply nested logic
- Separate concerns properly

---

# Security Rules

- Prevent SQL injection
- Prevent XSS vulnerabilities
- Sanitize all inputs
- Never expose secrets
- Use secure server-side validation
- Follow OWASP best practices

---

# AI Assistant Instructions

When generating code:

1. Determine whether the component is:
   - reusable UI component
   - feature/business component

2. Reusable UI components must go inside:

```txt
src/components/ui
```

3. Business-specific components must go inside:

```txt
src/components
```

4. Follow component folder structure strictly

5. Use camelCase for:
   - folders
   - file names

6. Use PascalCase for:
   - React component names

7. Use `.style.ts` for component styling

8. Do not use Tailwind CSS

9. Do not use external UI component libraries

10. Build reusable internal UI components only

11. Prioritize scalability, maintainability, consistency, and production-grade architecture
