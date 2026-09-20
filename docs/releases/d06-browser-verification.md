# D06 browser verification

`ce-test-browser mode:pipeline` checked the D06 branch against `ab903e14` after the
recovery repair `59004edd`. The existing host Browser integration drove one owned tab;
no credentials were entered, no browser state was injected, and the tab was closed.

The repository manager could not start an unconfigured standalone checkout: it exited
with the explicit server-environment prerequisite message. No listener or PID file
remained. The check instead used the plan's disposable production server at
`http://localhost:45815`, owned by run `76e0dce7b389f04ba6fe976e143e22af`.
The documented launcher workflow hook held that server after the existing authored suite
completed, then released it into a deliberately injected late failure and cleanup.
No alternate browser test framework was installed or introduced.

| Route / flow | Host Browser result | Evidence / limitation |
|---|---|---|
| `/` | Pass | Projects heading, empty public-project state, search field and navigation rendered; no visible error; Sign in was actionable |
| `/auth/signin` | Pass | OntoKit heading and Sign in with Zitadel control rendered; viewport screenshot captured |
| Sign in → disposable Zitadel login | Pass | Clicking the inspected Sign in button reached Welcome back, Loginname and Continue controls; full-page screenshot captured; no credential entered |
| `/projects/[id]/editor` | Skip | Requires an authenticated ordinary fixture; pipeline mode does not request human OAuth. The separate authored suite below verifies the real editor workflow |
| `/projects/[id]/pull-requests/[prNumber]` | Skip | Requires that authenticated fixture and PR; verified by the separate authored suite |

Host Browser result: **PARTIAL**, three rendered entry flows passed, two authenticated
flows skipped for the stated reason, zero observed console errors and no page failures.
Screenshots remain in the in-app evidence; no raw authentication URLs or session data
are stored here. No human verification was requested.

Separately, the repository's existing full-stack suite completed all **21 mandatory tests,
zero skips/failures**, using genuine fresh OIDC sessions and the real import/edit/save/
review/merge/reload journey. This is authored-suite evidence, not a claim that the host
Browser completed OAuth or the authenticated editor. The outer run then deliberately
failed after those checks: exit1, acceptedRun=false, complete cleanup, and unchanged
neighboring resources. Private diagnostics were verified complete with 0700/0600 modes
and one-hour expiry, then removed without printing their log. Final successful
repeatability receipts are recorded separately.
