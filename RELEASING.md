# Development, Release & Deploy Lifecycle

This document describes the full lifecycle of OntoKit Web from local development through release and deployment.

## Version Management

Version is managed in `package.json`:

```json
"version": "0.3.0-dev"
```

- The `dev` branch carries the `-dev` suffix (e.g. `0.3.0-dev`) during development.
- At release time the suffix is stripped (e.g. `0.3.0`) and merged to `main`.

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

## Branching Model

OntoKit Web uses a two-branch model:

| Branch | Purpose |
|--------|---------|
| **`dev`** | Default branch. All feature PRs target this branch. Carries the `-dev` version suffix. |
| **`main`** | Stable release branch. Always reflects the latest tagged release. |

## Releasing

Releases follow a Weblate-inspired workflow. All commands below are run from the `ontokit-web/` directory.

### 1. Prepare the release (on `dev`)

```bash
git checkout dev
node scripts/prepare-release.mjs
```

This script:
1. Reads the current version from `package.json` (e.g. `0.3.0-dev`).
2. Strips the `-dev` suffix to produce the release version (`0.3.0`).
3. Updates `package.json`.
4. Creates a git commit: `chore: releasing 0.3.0`.

### 2. Push `dev` and open a PR to `main`

```bash
git push origin dev
gh pr create --base main --head dev \
  --title "Release ontokit-web 0.3.0" \
  --body "Release ontokit-web 0.3.0"
```

CI will run the quality checks on the PR. Once they pass, approve and merge the PR.

> **Note:** `main` is protected — direct pushes are not allowed. All changes to `main` must go through a pull request with passing status checks and an approving review.

### 3. Tag the release (on `main`)

After the PR is merged, pull `main` and tag it:

```bash
git checkout main
git pull origin main
git tag -s ontokit-web-0.3.0
```

Tags must match the pattern `ontokit-web-*` to trigger the publish pipeline.

### 4. Push the tag

```bash
git push origin ontokit-web-0.3.0
```

### 5. CI publishes automatically

When the tag reaches GitHub, the CI workflow runs the quality jobs and then two publish jobs in parallel:

- **publish_github** &mdash; Creates a GitHub Release with auto-generated release notes.
- **publish_docker** &mdash; Builds the production Docker image and pushes it to the GitHub Container Registry. The image is tagged with the release version, the major.minor version, and `latest`. For example, the tag `ontokit-web-0.3.0` produces:
  - `ghcr.io/<owner>/ontokit-web:0.3.0`
  - `ghcr.io/<owner>/ontokit-web:0.3`
  - `ghcr.io/<owner>/ontokit-web:latest`

### 6. Set the next development version (on `dev`)

```bash
git checkout dev
node scripts/set-version.mjs 0.4.0
git push origin dev
```

This script:
1. Updates `package.json` to `0.4.0-dev`.
2. Creates a git commit: `chore: setting version to 0.4.0-dev`.

### Quick reference

```
dev branch:
  0.3.0-dev ──prepare-release.mjs──▸ 0.3.0 ──push──▸ PR to main
                                                          │
main branch:                                       merge & tag
                                                          │        ┌─ GitHub Release
                                                          ▼─push─▸ CI─┤
                                                                       └─ GHCR (Docker image)
dev branch:
                                            set-version.mjs 0.4.0
                                                          │
                                                      0.4.0-dev  (next cycle)
```

## Patch releases

Patch releases are for **backporting critical bug fixes** to an older release line after `dev` has already moved to the next development version. New features always ship in the next minor or major release on `dev`.

For example, if `dev` is at `0.4.0-dev` but a bug is found in `0.3.0`:

### 1. Create a release branch from the tag

```bash
git checkout -b release/0.3.x ontokit-web-0.3.0
```

### 2. Cherry-pick the fix

```bash
git cherry-pick <commit-sha>    # the fix from dev or main
```

### 3. Bump to the patch version

```bash
npm pkg set version=0.3.1
git add package.json
git commit -m "chore: releasing 0.3.1"
```

### 4. Tag and push

```bash
git tag -s ontokit-web-0.3.1
git push -u origin release/0.3.x && git push --tags
```

CI will run the quality checks and publish the GitHub Release and Docker image as usual. The `release/0.3.x` branch can be kept for future patches on the same line.

After publishing, open a PR from the release branch to `main` so it reflects the latest release:

```bash
gh pr create --base main --head release/0.3.x \
  --title "Merge patch release 0.3.1 into main" \
  --body "Fast-forward main to patch release 0.3.1"
```

> **Note:** The `latest` Docker tag will point to the patch release. If the latest minor/major release should remain `latest`, manually retag after publishing.

## Deployment

### From GHCR (Docker image)

Pull the pre-built production image published by CI:

```bash
# latest release
docker pull ghcr.io/<owner>/ontokit-web:latest

# specific version
docker pull ghcr.io/<owner>/ontokit-web:0.3.0
```

Run it directly:

```bash
docker run -d \
  --name ontokit-web \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=https://api.example.com \
  -e NEXT_PUBLIC_WS_URL=wss://api.example.com \
  ghcr.io/<owner>/ontokit-web:0.3.0
```

Or reference it in a compose file:

```yaml
services:
  web:
    image: ghcr.io/<owner>/ontokit-web:0.3.0
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
