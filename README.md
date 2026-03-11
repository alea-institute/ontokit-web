# OntoKit Web

[![Lint](https://github.com/CatholicOS/ontokit-web/actions/workflows/release.yml/badge.svg?event=push)](https://github.com/CatholicOS/ontokit-web/actions/workflows/release.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.9.0-brightgreen?logo=node.js)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-ghcr.io-2496ED?logo=docker)](https://github.com/CatholicOS/ontokit-web/pkgs/container/ontokit-web)

The web frontend for OntoKit - a collaborative OWL ontology curation platform.

## Features

- Modern React-based UI with Next.js 15
- Real-time collaborative editing
- Class hierarchy visualization
- Multi-language support (i18n)
- Dark mode support
- Responsive design

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19, Tailwind CSS, Radix UI
- **State**: Zustand, TanStack Query
- **Auth**: NextAuth.js with Zitadel
- **i18n**: next-intl
- **Visualization**: D3.js

## Quick Start

### Prerequisites

- Node.js 22+
- npm or pnpm

### Development Setup

```bash
# Clone the repository
git clone https://github.com/CatholicOS/ontokit-web.git
cd ontokit-web

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env.local
# Edit .env.local with your settings

# Run the development server
npm run dev
```

The app will be available at http://localhost:3000

## Docker

```bash
# Build the image
docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://api:8000 \
  --build-arg NEXT_PUBLIC_WS_URL=ws://api:8000 \
  -t ontokit-web .

# Run the container
docker run -p 3000:3000 ontokit-web
```

## Project Structure

```
ontokit-web/
├── app/                    # Next.js app router pages
│   ├── [locale]/          # Internationalized routes
│   ├── api/               # API routes (BFF)
│   └── globals.css        # Global styles
├── components/
│   ├── ui/                # Reusable UI components
│   ├── editor/            # Ontology editor components
│   └── collab/            # Collaboration components
├── lib/
│   ├── api/               # API client
│   ├── collab/            # WebSocket collaboration
│   ├── ontology/          # OWL type definitions
│   └── i18n/              # Internationalization
├── messages/              # Translation files
├── public/                # Static assets
├── tailwind.config.ts
├── next.config.ts
└── README.md
```

## Scripts

```bash
# Development
npm run dev         # Start development server
npm run build       # Build for production
npm run start       # Start production server

# Quality
npm run lint        # Run ESLint
npm run lint:fix    # Fix ESLint issues
npm run type-check  # TypeScript type checking

# Testing
npm run test        # Run tests
npm run test:coverage  # Run tests with coverage
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL for collaboration |
| `ZITADEL_ISSUER` | Zitadel OIDC issuer URL |
| `ZITADEL_CLIENT_ID` | Zitadel client ID |
| `ZITADEL_CLIENT_SECRET` | Zitadel client secret |
| `NEXTAUTH_URL` | NextAuth.js callback URL |
| `NEXTAUTH_SECRET` | NextAuth.js secret key |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
