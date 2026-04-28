# When a Coding Task Is Complete — ontokit-web

Run these BEFORE declaring work done or committing:

1. **Lint (auto-fix)**
   ```bash
   npm run lint:fix
   ```

2. **Type check (strict TS)**
   ```bash
   npm run type-check
   ```

3. **Tests**
   ```bash
   npm run test
   # or for coverage:
   npm run test:coverage
   ```

4. **Build sanity (when changing config, deps, or major surface)**
   ```bash
   npm run build
   ```

5. **(Optional/CI) Semgrep**
   ```bash
   semgrep --pro --config p/default --config p/owasp-top-ten \
     --config p/javascript --config p/typescript \
     --config p/react --config p/nextjs --config p/jwt
   # drop --pro if no Pro entitlement
   ```

6. **UI verification (rule from system prompt)**: For frontend changes, actually start the dev server and exercise the feature in a browser before reporting done. Type-check + tests verify code, not feature behavior.
   ```bash
   ./ontokit-web.sh restart
   # then open http://localhost:3000 (or PORT override)
   # tail -f .ontokit-web.log  for runtime errors
   ```

7. **CI** runs `semgrep ci` (diff-aware) — keep `.semgrepignore` honest.

## Watch-outs
- The two `react-hooks/*` warn-level rules (`set-state-in-effect`, `immutability`) are flagged TODOs — don't introduce new violations.
- Don't introduce `any` if avoidable; rule is `warn` but flagged.
- Backend coupling: API contract changes need coordinated work in `ontokit-api`.
