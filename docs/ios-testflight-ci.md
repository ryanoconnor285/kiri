# iOS TestFlight CI (GitHub Actions)

Automated uploads use **Fastlane** from [`apps/ios`](../apps/ios/) and the **Kiri-Staging** scheme with **ReleaseStaging** (optimized build + staging Railway API from [`ReleaseStaging.xcconfig`](../apps/ios/Config/ReleaseStaging.xcconfig)).

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
| `APPSTORE_ISSUER_ID` | Issuer UUID from App Store Connect API |
| `APPSTORE_KEY_ID` | Key ID (e.g. `AB12CD34EF`) |
| `APPSTORE_PRIVATE_KEY` | Full contents of the `.p8` file |
| `DEVELOPMENT_TEAM` | 10-character Team ID (Membership details) |

## Signing (pick one)

### Option A — fastlane match (recommended)

Private git repo for certs/profiles (can be empty to start).

| Secret | Value |
|--------|--------|
| `MATCH_GIT_URL` | HTTPS or SSH URL of the certificates repo |
| `MATCH_PASSWORD` | Encryption password for match |
| `MATCH_GIT_BASIC_AUTHORIZATION` | Optional: `base64(user:token)` for HTTPS clone |

**Once on your Mac** (with Xcode signed in):

```bash
cd apps/ios
bundle install
export APPSTORE_ISSUER_ID=...
export APPSTORE_KEY_ID=...
export APPSTORE_PRIVATE_KEY="$(cat AuthKey_XXX.p8)"
export MATCH_GIT_URL=git@github.com:you/kiri-ios-certs.git
export MATCH_PASSWORD=...
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
