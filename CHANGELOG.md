# Changelog

All notable changes to the MG Teacher desktop app are documented here, one
section per version bump. The GitHub Release for each version publishes its
matching section below as the release notes; the in-app update banner links
straight to that release.

## [0.0.4] - 2026-09-13

### Added
- Release notes: the GitHub Release for each version now publishes that version's `CHANGELOG.md` section as its notes, and the in-app update banner links straight to it ("What's new")

## [0.0.3] - 2026-09-13

### Added
- Full database backup/restore from Settings (admin-only): export everything to a single file, or restore from one
- A seeded default admin account on every fresh install, with a one-click "Log in as admin" option and a login/register toggle on the sign-in screen
- Per-teacher data isolation: classes, students, grades, attendance, schedules, and plans are now scoped to the teacher who owns them; admins still see and can reassign everything
- Double-booking detection when adding a schedule entry for a class or teacher
- Assessment grades, Final Year grade, and a weekly plans table
- Bulk import (CSV/Excel) for students, subjects, classes, and assessments, with downloadable templates

### Fixed
- Report/plan/progress-report exports now show an error message on failure instead of failing silently
- Subjects with no assigned teacher were uneditable in Grades
- File downloads doing nothing in the desktop app
- "MG Teacher is damaged and can't be opened" on macOS
- The desktop app version wasn't being bumped on release, so the in-app update banner never fired despite new builds shipping

### Changed
- Normalized all input/select heights across the app
