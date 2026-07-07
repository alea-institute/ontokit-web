# OntoKit Web

[![Lint](https://github.com/CatholicOS/ontokit-web/actions/workflows/release.yml/badge.svg?event=push)](https://github.com/CatholicOS/ontokit-web/actions/workflows/release.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.9.0-brightgreen?logo=node.js)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-ghcr.io-2496ED?logo=docker)](https://github.com/CatholicOS/ontokit-web/pkgs/container/ontokit-web)

The web frontend for OntoKit — a collaborative OWL ontology curation platform.

## Genesis

OntoKit grew out of a collaboration between two open-source projects that share a common need: making rules and laws accessible through structured, community-driven ontologies.

- **[FOLIO](https://openlegalstandard.org/)** (Free Open Legal Information Ontology) — a structured vocabulary for governmental rules and laws ([GitHub](https://github.com/alea-institute/FOLIO/))
- **[Catholic Semantic Canon](https://catholicdigitalcommons.org/)** (Catholic Digital Commons) — a structured vocabulary for the rules and laws of faith ([GitHub](https://github.com/CatholicOS/ontology-semantic-canon))

Both projects benefit from grassroots-level collaborative ontology editing — the kind of tooling that didn't exist in a modern, accessible form. That shared need is what drove OntoKit's creation.

## Features

- Modern React-based UI with Next.js 15
- Real-time collaborative editing
- Class hierarchy visualization
- Multi-language support (i18n)
- Dark mode support
- Responsive design

## Who It's For

OntoKit is built for the mixed communities that maintain a shared ontology — domain experts who know the subject but not the formalisms, engineers who live in Turtle, and the stewards who keep contributions coherent. Each has a tailored path through the app.

- **Domain contributor** (e.g., a canon-law scholar, a theologian, a legal analyst) — *Goal: capture their expertise as concepts and relationships without learning OWL.* Works in the **Standard** editor: a class tree, property and annotation forms, entity search, and multi-language labels. Instead of committing directly, they open a **suggestion** session that a maintainer reviews — so subject-matter knowledge flows in even without write access or RDF fluency.
- **Ontology engineer / knowledge modeler** — *Goal: model precisely and keep the ontology logically sound.* Switches to the **Developer** editor to edit Turtle/OWL source directly (Monaco), inspects the class hierarchy in the interactive graph, and runs quality, lint, consistency, and delete-impact checks. Semantic (embedding-based) search surfaces similar concepts to avoid duplicates before adding new ones.
- **Maintainer / ontology steward** (project owner or admin) — *Goal: protect quality while welcoming outside contributions.* Reviews **pull requests** and suggestion sessions with triple-level diffs, comments, requests changes, approves, and merges. Manages the team via join requests and roles (owner, admin, editor, reviewer, contributor, viewer) and syncs the merged ontology to a GitHub repository.
- **Project lead / community organizer** — *Goal: run a grassroots ontology effort.* Creates public or private projects, invites and permissions contributors, watches growth through project analytics, and coordinates the kind of open, collaborative editing that FOLIO and the Catholic Semantic Canon depend on.
- **Learner / ontology consumer** — *Goal: understand or reuse an existing ontology.* Browses public projects, reads the built-in guide (what an ontology is, common vocabularies, syntax, and formats), explores class hierarchies visually, and references the API for downstream integration.

## Use Cases

- **Crowd-sourced legal and canonical vocabularies** — maintain structured vocabularies for governmental rules and laws (FOLIO) and the rules and laws of faith (Catholic Semantic Canon), with domain experts contributing directly through guided forms.
- **Review-gated ontology curation** — accept changes from non-technical contributors as reviewable suggestions and pull requests, keeping a formal ontology accurate without granting everyone commit rights.
- **Collaborative OWL modeling** — let engineers edit Turtle source, visualize the class hierarchy, and run consistency and lint checks together on the same ontology in real time.
- **Duplicate-free concept authoring** — use semantic search over existing concepts to find and reuse near-matches before introducing redundant classes or properties.
- **Multilingual terminology management** — attach labels and annotations in multiple languages so an ontology serves international and cross-jurisdictional communities.
- **Versioned, auditable knowledge history** — track every change through branches, commits, and revision history, and review triple-level diffs before merging.
- **GitHub-backed publishing** — synchronize a curated ontology to a GitHub repository so it can be versioned, released, and consumed by downstream tools.

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
