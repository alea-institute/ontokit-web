# Suggested Commands — ontokit-web

## First-time setup
```bash
npm install
cp .env.example .env.local      # then edit
```

## Dev server (preferred: lifecycle script)
```bash
./ontokit-web.sh start          # background, logs → .ontokit-web.log, pid → .ontokit-web.pid
./ontokit-web.sh stop
./ontokit-web.sh restart
./ontokit-web.sh status
./ontokit-web.sh restart --force   # kill any blocking process on the port
```
- The script auto-detects non-interactive stdin and behaves like `--force` (kills blockers without prompting).
- Override port: `PORT=4000 ./ontokit-web.sh start`.
- Clear Next cache: `rm -rf .next && ./ontokit-web.sh start`.
- Use this in agents/scripts; only fall back to `npm run dev` for interactive foreground work.

## Raw npm scripts
```bash
npm run dev              # foreground dev server (next dev)
npm run build            # next build
npm run start            # next start (production)
npm run lint             # eslint .
npm run lint:fix         # eslint --fix .
npm run type-check       # tsc --noEmit
npm run test             # vitest
npm run test:coverage    # vitest --coverage
```

## Docker
```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://api:8000 \
  --build-arg NEXT_PUBLIC_WS_URL=ws://api:8000 \
  -t ontokit-web .

docker run -p 3000:3000 ontokit-web
```

## Security scan (Semgrep)
With Pro:
```bash
semgrep --pro --config p/default --config p/owasp-top-ten \
  --config p/javascript --config p/typescript \
  --config p/react --config p/nextjs --config p/jwt
```
Without Pro: drop `--pro`.

## System utilities (Linux/WSL2)
Standard GNU coreutils (`ls`, `cd`, `grep`, `find`, `git`).
Prefer Serena's `find_file`, `search_for_pattern`, `find_symbol` over shell `find`/`grep` inside the repo.
