# OntoKit Web

[![Lint](https://github.com/CatholicOS/ontokit-web/actions/workflows/release.yml/badge.svg?event=push)](https://github.com/CatholicOS/ontokit-web/actions/workflows/release.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.9.0-brightgreen?logo=node.js)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-ghcr.io-2496ED?logo=docker)](https://github.com/CatholicOS/ontokit-web/pkgs/container/ontokit-web)
[![codecov](https://codecov.io/gh/CatholicOS/ontokit-web/graph/badge.svg?token=HIQ9Y8ZWDA)](https://codecov.io/gh/CatholicOS/ontokit-web)

The web frontend for OntoKit — a collaborative OWL ontology curation platform.

## Genesis

OntoKit grew out of a collaboration between two open-source projects that share a common need: making rules and laws accessible through structured, community-driven ontologies.

- **[FOLIO](https://openlegalstandard.org/)** (Free Open Legal Information Ontology) — a structured vocabulary for governmental rules and laws ([GitHub](https://github.com/alea-institute/FOLIO/))
- **[Catholic Semantic Canon](https://catholicdigitalcommons.org/)** (Catholic Digital Commons) — a structured vocabulary for the rules and laws of faith ([GitHub](https://github.com/CatholicOS/ontology-semantic-canon))

Both projects benefit from grassroots-level collaborative ontology editing — the kind of tooling that didn't exist in a modern, accessible form. That shared need is what drove OntoKit's creation.

## Features

- **Ontology editor** with three-panel layout (class tree, detail panel, source view)
- **Monaco editor** with custom Turtle syntax highlighting, hover IRI resolution, and Ctrl+Click navigation
- **Real-time collaboration** via WebSocket
- **Pull request workflow** for reviewing and merging ontology changes
- **Ontology health checks** with 20+ semantic linting rules
- **Graph visualization** of class hierarchies using D3.js
- **Git-style revision history** with branch management
- **Multi-language support** (i18n via next-intl)
- **Dark mode** and responsive design
- **API documentation** browser

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19, Tailwind CSS, Radix UI
- **State**: Zustand, TanStack Query
- **Auth**: NextAuth.js with Zitadel
- **i18n**: next-intl
- **Visualization**: D3.js

## Quick Start

### Prerequisites

- Node.js 20.9+
- npm

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
├── app/                        # Next.js app router pages
│   ├── [locale]/               # Internationalized routes
│   ├── api/                    # API routes (BFF)
│   ├── api-docs/               # API documentation browser
│   ├── auth/                   # Authentication pages
│   ├── docs/                   # Documentation pages
│   ├── projects/               # Project and editor pages
│   └── settings/               # User settings
├── components/
│   ├── ui/                     # Reusable Radix-based UI components
│   ├── editor/                 # Ontology editor (ClassTree, TurtleEditor, etc.)
│   ├── pr/                     # Pull request workflow
│   ├── revision/               # Branch and revision history
│   ├── graph/                  # Ontology graph visualization
│   ├── diff/                   # Diff viewer
│   ├── collab/                 # Collaboration indicators
│   ├── layout/                 # Layout components (header, sidebar)
│   ├── projects/               # Project listing and management
│   ├── suggestions/            # Suggestion components
│   ├── docs/                   # Documentation components
│   ├── icons/                  # Custom SVG icons
│   └── auth/                   # Auth-related components
├── lib/
│   ├── api/                    # Type-safe API clients
│   ├── editor/                 # Monaco editor support (Turtle language, LSP, Web Worker)
│   ├── ontology/               # OWL entity type definitions
│   ├── collab/                 # WebSocket collaboration client
│   ├── graph/                  # Graph data structures
│   ├── git-graph/              # Git history graph
│   ├── hooks/                  # Custom React hooks
│   ├── stores/                 # Zustand stores
│   ├── context/                # React context providers
│   ├── i18n/                   # Internationalization
│   └── docs/                   # Documentation utilities
├── messages/                   # Translation files
├── public/                     # Static assets
├── __tests__/                  # Vitest test suites
├── scripts/                    # Release and version management scripts
├── next.config.ts
└── tailwind.config.ts
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
