# Publishing

One runbook per registry. Each says what you do once by hand, what CI does every time, and the
thing that will bite you if nobody warned you.

**Current state**

| Language | Registry | Status |
| --- | --- | --- |
| TypeScript | npm | published `0.1.0`, trusted publishing configured |
| Python | PyPI | published `0.1.0`, trusted publishing configured |
| Go | none — a git tag *is* the release | not tagged yet |
| Rust | crates.io | not published; needs one manual publish first |
| C# | NuGet | not published; pipeline ready |
| Kotlin/Java | Maven Central | not published; needs a namespace and a GPG key |

**How a release works here.** You bump the version *inside the package*, then push a tag. The
tag prefix selects the package, and `release.yml` refuses to publish if the tag and the
declared version disagree — that guard is tested. A second workflow records the release on
GitHub so it shows in the Releases sidebar.

| Package | Tag | Publishes to |
| --- | --- | --- |
| `packages/ts` | `ts-v0.1.0` | npm |
| `packages/py` | `py-v0.1.0` | PyPI |
| `packages/kotlin` | `kotlin-v0.1.0` | Maven Central |
| `packages/csharp` | `csharp-v0.1.0` | NuGet |
| `packages/rust` | `rust-v0.1.0` | crates.io |
| `packages/go` | `packages/go/v0.1.0` | nothing to publish; the tag is the release |

Every workflow that publishes uses the `release` GitHub environment. The environment name is
part of what each registry's trusted-publishing policy verifies, so it has to match exactly.

---

## Go — nothing to configure

There is no registry. `go get` resolves a version from a repository tag and
`proxy.golang.org` caches it; `pkg.go.dev` indexes it from the same request.

```bash
git tag packages/go/v0.1.0
git push origin packages/go/v0.1.0

# Warm the proxy so the version is fetchable immediately, and confirm it resolved.
GOPROXY=proxy.golang.org go list -m github.com/Andrew-Tellez/patterns/packages/go@v0.1.0
```

**The tag prefix is not a choice.** The Go module proxy requires a module in a subdirectory to
be tagged with that subdirectory: `packages/go/v0.1.0`. A tag named `go-v0.1.0` is invisible to
`go get`. That is also why `cog.toml` has no `[packages.go]` entry — cocogitto's
`<name>-v<version>` scheme cannot produce it.

⚠️ **A published version is immutable.** Once the proxy has fetched `v0.1.0`, that version
exists forever with that content. Deleting or moving the tag does not undo it, because the
proxy serves its cache. If you get it wrong, the fix is `v0.1.1`.

---

## Rust — crates.io

**The one exception to keyless publishing: the first release must be manual.** crates.io
requires the crate to exist and you to own it before a trusted publisher can be attached.
There is no "pending publisher" like PyPI's.

### Once, by hand

1. Sign in at [crates.io](https://crates.io) with GitHub.
2. Account Settings → **API Tokens** → New Token. Scopes: **`publish-new`** and
   `publish-update`. Copy it — it is shown once.
3. Authenticate and publish:

```bash
cargo login                      # paste the token
cd packages/rust
cargo publish --dry-run          # 12 files, ~52 KiB; this already passes
cargo publish
```

4. Now attach the trusted publisher: crate page → Settings → **Trusted Publishing** → Add:

| Field | Value |
| --- | --- |
| Repository owner | `Andrew-Tellez` |
| Repository name | `patterns` |
| Workflow filename | `release.yml` |
| Environment | `release` |

5. Delete the API token you created in step 2. Nothing needs it any more.

### Every release after that

```bash
# bump `version` in packages/rust/Cargo.toml, commit, then:
git tag rust-v0.1.1 && git push origin rust-v0.1.1
```

CI runs `cargo fmt --check`, `cargo clippy --all-targets` and `cargo test`, fetches a
temporary token through `rust-lang/crates-io-auth-action`, publishes, and the action's post
step revokes the token.

⚠️ **A published version cannot be replaced.** You can *yank* it, which stops new dependents
from resolving to it, but existing lockfiles keep working and the version number is spent.

---

## C# — NuGet

NuGet's trusted publishing can create a package that does not exist yet, so the first release
comes straight from CI. No API key at any point.

### Once, by hand

1. Sign in at [nuget.org](https://www.nuget.org).
2. Your username → **Trusted Publishing** → new policy:

| Field | Value |
| --- | --- |
| Repository Owner | `Andrew-Tellez` |
| Repository | `patterns` |
| Workflow File | `release.yml` |
| Environment | `release` |

3. **Set the policy scope to allow publishing new packages**, not only new versions of
   existing ones. With the narrower scope the first release is rejected.
4. GitHub → Settings → Environments → `release` → new secret **`NUGET_USER`**, set to your
   nuget.org *profile name*. Not your email. It is not a credential, but it is not public
   either, so it lives as a secret.

### Then

```bash
git tag csharp-v0.1.0 && git push origin csharp-v0.1.0
```

⚠️ **A new policy is only *temporarily* active, for 7 days.** NuGet pins a policy to the
GitHub repository and owner IDs to prevent a resurrection attack — delete a repo, recreate it
with the same name, publish as if nothing happened — and it only learns those IDs from a
successful publish. Publish inside the window and the policy becomes permanent. Miss it and
you re-arm it from the same page.

---

## Kotlin / Java — Maven Central

The heaviest of the five, and the only registry here with **no OIDC**, so it is the only one
that needs long-lived credentials.

### 1. Verify the namespace

[central.sonatype.com](https://central.sonatype.com) (sign in with GitHub) → **Namespaces** →
Add `io.github.andrew-tellez`. It gives you a verification code; create a **public repository
named exactly that code** under your account, then press Verify. Free, and no domain needed —
the GitHub namespace is verified by proving you control the account.

The namespace has to match the `group` in `packages/kotlin/build.gradle.kts`, which is already
`io.github.andrew-tellez`.

### 2. Create and publish a GPG key

Central rejects unsigned artifacts, and it checks the signature against a public keyserver, so
the `--send-keys` step is not optional.

```bash
gpg --full-generate-key                        # RSA, 4096 bits
gpg --list-secret-keys --keyid-format=long     # copy the 40-character fingerprint
gpg --keyserver keyserver.ubuntu.com --send-keys <FINGERPRINT>
gpg --armor --export-secret-keys <FINGERPRINT> # the whole block is SIGNING_KEY
```

Keep the private key and its passphrase somewhere you will still have them in two years. A
lost signing key means every future release needs a new one published and propagated.

### 3. Get a Portal token

Central Portal → Account → **Generate User Token**. It returns a username and a password that
are *not* your login. Those are `CENTRAL_USERNAME` and `CENTRAL_PASSWORD`.

### 4. Four secrets on the `release` environment

| Secret | Value |
| --- | --- |
| `CENTRAL_USERNAME` | from the user token |
| `CENTRAL_PASSWORD` | from the user token |
| `SIGNING_KEY` | the armoured private key, `BEGIN`/`END` lines included |
| `SIGNING_PASSPHRASE` | that key's passphrase |

### 5. Tag, then click Publish

```bash
git tag kotlin-v0.1.0 && git push origin kotlin-v0.1.0
```

CI runs the tests and the coverage gate, builds the deployment bundle — a zipped Maven
repository layout with the jar, sources jar, javadoc jar, POM and a `.asc` signature for each —
**checks that the signatures are actually there** and fails with a message naming the missing
secret if they are not, then uploads it.

The upload uses `publishingType=USER_MANAGED`, so the deployment is validated and then waits
for you at [central.sonatype.com/publishing/deployments](https://central.sonatype.com/publishing/deployments).
Press **Publish** there. Change one word in `release.yml` to `AUTOMATIC` once you trust it.

⚠️ **Maven Central has no unpublish.** None. That is why it is not automatic by default.
Expect ~30 minutes for the artifact to appear after you approve it.

Java consumers get the same artifact — it is a plain JVM jar, and
`src/test/java/.../JavaInteropTest.java` is a test written as a Java caller, so the interop is
verified rather than claimed.

---

## What shows up on the repository page

**Nothing you publish to npm, PyPI, crates.io, NuGet or Maven Central will ever appear in
GitHub's "Packages" sidebar.** That section lists packages published to *GitHub Packages*, its
own registry, and nothing else. Publishing more versions will not change it.

What does make a published version visible:

- the **README badges**, which read the version live from each registry, and
- the **Releases** section, filled by `github-release.yml` from each package tag.

For a tag pushed before that workflow existed, run it once by hand: Actions → **github
release** → Run workflow → enter the tag.

---

## If a publish fails

The failure is almost always one of these, and each fails loudly rather than publishing
something wrong:

| Symptom | Cause |
| --- | --- |
| `tag ... says X, ... says Y` | The tag and the version inside the package disagree. Fix the version, delete the tag, re-tag. |
| npm `403` mentioning 2FA | The token lacks the 2FA bypass, or trusted publishing is not configured for the package. |
| PyPI or NuGet rejecting the OIDC token | A field in the policy does not match: owner, repository, workflow filename, or environment name. |
| Maven bundle rejected for missing signatures | `SIGNING_KEY` is not set on the `release` environment. The job checks for `.asc` files before uploading and says so. |
| Maven rejected after upload | The namespace is not verified, or the public key never reached a keyserver. |
| `cargo publish` asking for a token in CI | The crate does not exist yet — crates.io needs that first manual publish. |
