# iOS TestFlight CI (GitHub Actions)

Automated uploads use **Fastlane** from [`apps/ios`](../apps/ios/) and the **Kiri-Staging** scheme with **ReleaseStaging** (optimized build + staging Railway API from [`ReleaseStaging.xcconfig`](../apps/ios/Config/ReleaseStaging.xcconfig)).

The workflow file lives on the repo **default branch** (`main`). Use **Actions → iOS TestFlight → Run workflow** from `main`; tag pushes (`testflight/*`) should be on a branch that contains this workflow.

## Triggers

| Event | When it runs |
|-------|----------------|
| **Actions → iOS TestFlight → Run workflow** | Manual |
| **Git tag** `testflight/*` | e.g. `git tag testflight/0.1.0 && git push origin testflight/0.1.0` |

Build numbers come from `github.run_number` (must increase every upload).

## One-time Apple setup

1. [Apple Developer Program](https://developer.apple.com/programs/) membership.
2. [App Store Connect](https://appstoreconnect.apple.com/) → create app with bundle ID **`app.kiri.study`**.
3. **Users and Access → Integrations → App Store Connect API** → create key with **App Manager** (or Admin). Download the `.p8` once.

## GitHub secrets (required)

| Secret | Value |
|--------|--------|
| `APPSTORE_ISSUER_ID` | **Issuer UUID** from App Store Connect → Users and Access → Integrations → App Store Connect API (not your 10-character Team ID) |
| `APPSTORE_KEY_ID` | Key ID (e.g. `AB12CD34EF`) |
| `APPSTORE_PRIVATE_KEY` | Full contents of the `.p8` file (set with `gh secret set APPSTORE_PRIVATE_KEY < AuthKey_XXX.p8`) |
| `DEVELOPMENT_TEAM` | 10-character **Team ID** (Membership details) |

## Signing (pick one)

### Option A — fastlane match (recommended)

Private git repo for certs/profiles (e.g. `kiri-ios-certs` on GitHub). Match stores encrypted certs on branch **`main`** (override with env `MATCH_GIT_BRANCH`).

| Secret | Value |
|--------|--------|
| `MATCH_GIT_URL` | HTTPS or SSH URL of the certificates repo |
| `MATCH_PASSWORD` | **Required.** Same passphrase you chose for match encryption (CI fails silently if empty) |
| `MATCH_GIT_BASIC_AUTHORIZATION` | Recommended for CI: `echo -n 'user:github_pat_…' \| base64` (PAT needs **Contents: Read** on the certs repo) |
| `MATCH_GIT_BRANCH` | Optional. Local match defaults to **`main`** ([`Matchfile`](../apps/ios/fastlane/Matchfile)). CI defaults to **`master`** if unset until `master` is merged into `main` on the certs repo. |

If GitHub’s default branch on the certs repo is `main` but the latest match push went to `master`, merge `master` → `main` on that repo (or set `MATCH_GIT_BRANCH=master` in GitHub until they match).

**Once on your Mac** (with Xcode signed in):

```bash
cd apps/ios
bundle install
export APPSTORE_ISSUER_ID=...
export APPSTORE_KEY_ID=...
export APPSTORE_PRIVATE_KEY="$(cat AuthKey_XXX.p8)"
export MATCH_GIT_URL=git@github.com:you/kiri-ios-certs.git
export MATCH_PASSWORD=...
# Optional if not using main yet: export MATCH_GIT_BRANCH=master
bundle exec fastlane match appstore
```

Commit/push the generated certs repo. CI uses `match` **readonly**.

### Option B — manual p12 + profile

Export **Apple Distribution** certificate as `.p12` and download **App Store** provisioning profile for `app.kiri.study`.

| Secret | Value |
|--------|--------|
| `IOS_DISTRIBUTION_CERTIFICATE_BASE64` | `base64 -i cert.p12 \| pbcopy` |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` | p12 password |
| `IOS_PROVISIONING_PROFILE_BASE64` | `base64 -i profile.mobileprovision \| pbcopy` |
| `IOS_PROVISIONING_PROFILE_NAME` | Exact name in Xcode (e.g. `Kiri App Store`) |

Leave `MATCH_GIT_URL` unset in GitHub.

## Local dry run

Same env vars as CI, then:

```bash
cd apps/ios
bundle install
bundle exec fastlane testflight_staging
```

## Staging API URL

CI builds embed the URL in [`Staging.xcconfig`](../apps/ios/Config/Staging.xcconfig) (included by ReleaseStaging). Update that file when the Railway **API** host changes—not the web app URL.

## After upload

App Store Connect → **TestFlight** → wait for processing → add **Internal** or **External** testers.

Railway **web** and **API** deploys are separate; this pipeline only ships the iOS binary.
