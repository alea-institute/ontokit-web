# Development, Release & Deploy Lifecycle

This document describes the full lifecycle of OntoKit Web from local development through release and deployment.

## Version Management

Version is managed in `package.json`:

```json
"version": "0.2.0-dev"
```

- During development the version carries a `-dev` suffix (e.g. `0.2.0-dev`).
- At release time the suffix is stripped (e.g. `0.2.0`).

## Development

### Local setup

```bash
cd ontokit-web
npm install
```

### Running the dev server

```bash
npm run dev          # Start development server at http://localhost:3000
```

### Code quality

```bash
npm run lint         # ESLint
npm run type-check   # TypeScript type checking
npm run test -- --run # Run tests (single run)
npm run build        # Production build
```

## Continuous Integration

The GitHub Actions workflow (`.github/workflows/release.yml`) runs on every push and on pull requests.

| Job | What it does |
|-----|--------------|
| **quality** | `npm run lint`, `npm run type-check`, `npm run test`, `npm run build` |

This job runs on all pushes (except `renovate/**` branches) and on PRs. The publish jobs described in the next section only run when a release tag is pushed.

## Releasing

Releases follow a Weblate-inspired workflow. All commands below are run from the `ontokit-web/` directory.

### 1. Prepare the release

```bash
node scripts/prepare-release.mjs
```

This script:
1. Reads the current version from `package.json` (e.g. `0.2.0-dev`).
2. Strips the `-dev` suffix to produce the release version (`0.2.0`).
3. Updates `package.json`.
4. Creates a git commit: `chore: releasing 0.2.0`.

### 2. Tag the release

```bash
git tag -s ontokit-web-0.2.0
```

Tags must match the pattern `ontokit-web-*` to trigger the publish pipeline.

### 3. Push

```bash
git push && git push --tags
```

### 4. CI publishes automatically

When the tag reaches GitHub, the CI workflow runs the quality job and then two publish jobs in parallel:

- **publish_github** &mdash; Creates a GitHub Release with auto-generated release notes.
- **publish_docker** &mdash; Builds the production Docker image and pushes it to the GitHub Container Registry. The image is tagged with the release version, the major.minor version, and `latest`. For example, the tag `ontokit-web-0.2.0` produces:
  - `ghcr.io/<owner>/ontokit-web:0.2.0`
  - `ghcr.io/<owner>/ontokit-web:0.2`
  - `ghcr.io/<owner>/ontokit-web:latest`

### 5. Set the next development version

```bash
node scripts/set-version.mjs 0.3.0
```

This script:
1. Updates `package.json` to `0.3.0-dev`.
2. Creates a git commit: `chore: setting version to 0.3.0-dev`.

Push the commit to start the next development cycle.

### Quick reference

```
                                                            ┌─ GitHub Release
0.2.0-dev ──prepare-release.mjs──▸ 0.2.0 ──tag & push──▸ CI─┤
                                                            └─ GHCR (Docker image)
                                                   │
                                 set-version.mjs 0.3.0
                                         │
                                     0.3.0-dev  (next cycle)
```

## Patch releases

Patch releases are for **backporting critical bug fixes** to an older release line after `main` has already moved to the next development version. New features always ship in the next minor or major release on `main`.

For example, if `main` is at `0.3.0-dev` but a bug is found in `0.2.0`:

### 1. Create a release branch from the tag

```bash
git checkout -b release/0.2.x ontokit-web-0.2.0
```

### 2. Cherry-pick the fix

```bash
git cherry-pick <commit-sha>    # the fix from main
```

### 3. Bump to the patch version

```bash
npm pkg set version=0.2.1
git add package.json
git commit -m "chore: releasing 0.2.1"
```

### 4. Tag and push

```bash
git tag -s ontokit-web-0.2.1
git push -u origin release/0.2.x && git push --tags
```

CI will run the quality checks and publish the GitHub Release and Docker image as usual. The `release/0.2.x` branch can be kept for future patches on the same line.

> **Note:** The `latest` Docker tag will point to the patch release. If the latest minor/major release should remain `latest`, manually retag after publishing.

## Deployment

### From GHCR (Docker image)

Pull the pre-built production image published by CI:

```bash
# latest release
docker pull ghcr.io/<owner>/ontokit-web:latest

# specific version
docker pull ghcr.io/<owner>/ontokit-web:0.2.0
```

Run it directly:

```bash
docker run -d \
  --name ontokit-web \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=https://api.example.com \
  -e NEXT_PUBLIC_WS_URL=wss://api.example.com \
  ghcr.io/<owner>/ontokit-web:0.2.0
```

Or reference it in a compose file:

```yaml
services:
  web:
    image: ghcr.io/<owner>/ontokit-web:0.2.0
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=https://api.example.com
      - NEXT_PUBLIC_WS_URL=wss://api.example.com
```

### Local Docker build

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000 \
  --build-arg NEXT_PUBLIC_WS_URL=ws://localhost:8000 \
  -t ontokit-web .
docker run -p 3000:3000 ontokit-web
```

### Environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL (baked at build time) |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL (baked at build time) |
| `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID`, `ZITADEL_CLIENT_SECRET` | OIDC auth provider |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | NextAuth.js configuration |
