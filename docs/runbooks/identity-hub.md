# Identity hub: add an app to OntoKit sign-in

This recipe gives an app (an OntoKit deployment, a FOLIO tool, a Catholic Digital Commons tool) the shared OntoKit sign-in: one account per person, with Google, GitHub, and email/password.

**Status (2026-11-04):** the hub is the **demo/staging** Zitadel at `https://ontokit-demo-auth.damienriehl.com`, running on the EU DEV host. It is not the production identity for FOLIO or CDCF. Production gets its own Zitadel on an ALEA- or CDCF-owned domain and its own Google project. The steps below stay the same; only the issuer URL changes.

## How it fits together

- **One Zitadel instance holds all accounts.** Google and GitHub sign-in are configured once, at the instance level. Every organization and app inherits them.
- **Google and GitHub each see one client: Zitadel** (callback `https://ontokit-demo-auth.damienriehl.com/idps/callback`). Adding an app never touches Google Cloud or GitHub. Google's consent screen shows the single umbrella name **OntoKit**.
- **Each brand is a Zitadel organization**, with its own branding and membership:

  | Organization | Apps |
  |---|---|
  | OntoKit | The OntoKit demo; default org |
  | ALEA / FOLIO | FOLIO tools |
  | Catholic Digital Commons Foundation (CDCF) | Catholic Semantic Canon and CDCF tools |

  Identities are shared across organizations. What a person can do inside each app is granted separately.

## Add an app (about 10 minutes)

1. **Create a Zitadel project** in the app's organization, or reuse the org's project (one per brand is fine).
2. **Add an application** to that project:
   - **Type:** Web, with OIDC.
   - **Auth method:**
     - **Server-side apps** (Next.js with NextAuth, FastAPI): Code with a client secret (`CLIENT_SECRET_BASIC`).
     - **Single-page or mobile apps:** PKCE.
   - **Redirect URI:** the app's callback. For NextAuth, that is `https://<app-host>/api/auth/callback/zitadel`.
   - **Post-logout URI:** `https://<app-host>` (and `https://<app-host>/`).
   - **Dev mode:** keep it off, unless you need `http://localhost` redirects for local development.
3. **Configure the app.** It needs the issuer `https://ontokit-demo-auth.damienriehl.com` (discovery at `/.well-known/openid-configuration`), the client ID, and the client secret. Keep the secret in the app's secret store, never in git.
4. **Roles (optional):** define project roles (for example `editor`, `reviewer`). Grant them to users or to another organization, then enable role assertion so the roles appear in tokens.
5. **Verify in a real browser.** Sign in with Google, GitHub, and email/password; sign out; confirm the app returns to its own origin.

## Operational notes

- **Self-registration is on at the instance level.** New users can sign up from any app's login page.
- **Email:** verification and password-reset emails need a real email provider (planned: Resend free tier, or Cloudflare Email Service). Until then, email-code verification is off, and password resets need an operator.
- **Org login copy:** each org's login copy ("Create your … account") is set with Zitadel's hosted-login translation setting at the organization level. User-facing wording is approved by Damien before it goes live.
- **Host work:** host-side changes on the demo hub go through the `ontokit-eu` wrapper. See the BAIF receipt in `docs/releases/baif-2026-11/README.md` for the deploy and memory rules.
