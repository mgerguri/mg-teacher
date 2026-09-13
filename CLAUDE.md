# MG Teacher

## Desktop app releases (`desktop-main` branch only)

`.github/workflows/build-desktop.yml` builds and publishes a GitHub Release
on every push to `desktop-main`, tagged `desktop-v<version>` from
`apps/desktop/src-tauri/tauri.conf.json`'s `package.version`. The in-app
update banner (`apps/web/src/components/UpdateBanner.tsx`) compares the
running app's version against that same file on `desktop-main`, so **if the
version doesn't change, the banner never fires** — it doesn't matter how
much code shipped.

**Rule: every push to `desktop-main` that changes app behavior must bump the
version and add a `CHANGELOG.md` entry, in the same push.**

1. Bump the version in all of these together (they must stay in sync):
   - `apps/desktop/src-tauri/tauri.conf.json` (`package.version`)
   - `apps/desktop/src-tauri/Cargo.toml` (`version`)
   - `apps/desktop/src-tauri/Cargo.lock` (the `mg-teacher-desktop` package entry — search for `name = "mg-teacher-desktop"`, its `version` line is right below)
   - `apps/desktop/package.json` (`version`)
2. Add a new `## [x.y.z] - YYYY-MM-DD` section at the top of `CHANGELOG.md`,
   above the previous entry, summarizing what changed in user-facing terms
   (not raw commit messages). The release workflow extracts this exact
   section and uses it as the GitHub Release body — if the heading doesn't
   match the version exactly, the release notes come out empty.
3. Use semver: patch (`x.y.Z`) for fixes, minor (`x.Y.0`) for
   backward-compatible features, major (`X.0.0`) for breaking changes. Given
   this app's low version numbers so far, patch/minor bumps are the norm.

Skip the bump only for changes that don't touch the desktop app at all
(docs, CI-only tweaks unrelated to the release, etc.) — anything a user of
the installed app could notice needs one.

## Branch strategy

`main` is the cloud-backed branch (auth/sync hit a real backend + Postgres).
`desktop-main` is a separate, offline-only branch for the Tauri desktop
build — no backend required. New features generally need to land on both,
adapting the auth/sync/storage touchpoints to each branch's model.
