# 18. Importing the old Sailix database into v2 (design, not built)

Status: **built and tested on invented data; not yet run against real data.** The seven decisions in section 5 were settled
by taking the recommendations. Command: `php artisan legacy:import --dry-run [--files=DIR] [--include-licenses]`.
The old database is configured with `LEGACY_DB_*` (host, port, database, username, password); the importer refuses a source
user that can write, or a target that is the same database.

Originally: proposal. Nothing here had been built or run. The old database was only inspected
read-only (column structure and aggregate counts; no personal data was read or copied).

## 1. What was found

The staging database `sailix_consol_medel` is the **old single-organization Sailix** (Laravel, 4 migrations, latest 2024),
not a v2 database. It has no `tenants`, `memberships`, roles or UUIDs.

| Old table | Rows | Meaning |
|---|---|---|
| `tb_user` | 5 | people: 1 `ROLE_ADMIN`, 4 `ROLE_USER`; one organization (`client_code` = SFAI); passwords are bcrypt (`$2y$`) |
| `pl_document_type` | 10 | document categories (A to J) |
| `pl_documents` | 1,606 | the list of document kinds (1,567 distinct names) |
| `tb_crew_document` | 55 | a crew member's document records (2 crew ids) |
| `tb_crew_document_upload` | 10 | uploaded files awaiting or past review (9 Pending, 1 Approved), all PDF |
| `tb_announcement` | 1 | one announcement, with a file name |
| `tb_to_do_list` | 2 | two New to-dos |
| `tb_task`, `tb_notification`, `tb_task_comment`, `system_logs` | 5 / 169 / 7 / 34 | no v2 counterpart |

The volume is tiny, so the import can be checked row by row.

## 2. Approach

- A **re-runnable artisan command** (`legacy:import`) reads the old database through a second, read-only connection
  and writes into a **separate v2 database**. The old database is never written to and its schema is never changed.
- Every imported row keeps its old id in a `legacy_id` column (or a small `legacy_map` table), so running the command
  again updates rows instead of duplicating them. This allows a trial run, a dry run (`--dry-run`: counts and problems, no
  writes) and a final run, and lets the old app keep running meanwhile.
- All writes happen inside the sanctioned platform code path (`app/Platform`), which is the only place allowed to
  cross organization boundaries. The static tenancy checks stay as they are.
- The organization is **created from `client_code`** (SFAI) if it does not exist, in state `provisioning`, with the
  address name taken from the code.

## 3. Field mapping

### People: `tb_user` to `users`, `memberships`, `crew_profiles`

| Old | New | Notes |
|---|---|---|
| `username`, `email_address` | `users.username`, `users.email` | both are unique in v2; see 5.1 for the duplicate email |
| `password` | `users.password` | bcrypt carries over unchanged, so people sign in with their old password |
| first/middle/last/suffix name | `crew_profiles.*` | `display_name` = first + last |
| `userType` `ROLE_ADMIN` / `ROLE_USER` | `memberships.role` `tenant_admin` / `crew` | |
| `is_inactive` `Y` / `N` | `memberships.status` `suspended` / `active` | `is_app_registration = Y` would map to `pending` (none today) |
| `crewID` | `crew_profiles.crew_number` | unique per organization; empty means no crew number |
| `dateof_birth` | `crew_profiles.birthday` | needs the birthday decision, see 5.4 |
| `mobile_number` | `crew_profiles.mobile` | |
| `gender`, `is_first_time`, `remember_token`, `email_verified_at` | not imported | v2 does not store gender; people verify again |
| rank, fleet, vessel, employment status, arrive/depart | empty | the old `tb_user` does not hold them |

### Documents

| Old | New | Notes |
|---|---|---|
| `pl_documents` (`document_name`, `document_shortname`, `is_inactive`) | `document_types` (`name`, `short_name`, `is_active`) | name is unique per organization in v2: see 5.2 |
| `pl_document_type` category | not imported | v2 types have no category |
| `tb_crew_document_upload` | `crew_documents` | `Pending` / `Approved` / `Rejected` to `pending` / `approved` / `rejected`; `rejection_reason`, number, grade, location, school, issued/expiry copy across; `approved_by` to `reviewed_by_membership_id`; file: see 5.3 |
| `tb_crew_document` | `crew_documents` (approved) | these hold no file in v2 terms: see 5.3. Their two `crewID`s match **no** user |

### Communication

| Old | New | Notes |
|---|---|---|
| `tb_announcement` `title`, `description`, `date_expired`, `is_inactive` | `announcements` `title`, `body`, `expires_at`, `is_active` | `creatorID` to `created_by_membership_id` |
| `groupNames` (here `ABACUS`) | `announcement_fleets` | the old "group" is the closest thing to v2's fleet |
| `employmentStatus` (here `VACATION`) | not imported | v2 audiences are fleets only |
| `filename` | attachment: see 5.3 | |
| `tb_to_do_list` | `todos` | `New` / `Ongoing` to open, `Completed` to done; `todo_due_date` to `due_date`; `userID` to `membership_id` |

## 4. Safety rules

1. The old connection is **read-only** (database user without write grants; the command also refuses a connection that has
   any). It never runs `migrate` against it.
2. The import target must be a **different database** from the old one; the command refuses to start when both names
   are equal.
3. It never runs the demo seeder. No placeholder passwords are created.
4. Personal data is copied only for the fields in section 3. Nothing is printed: the report shows counts and ids.
5. Order of a real run: backup of the target, `--dry-run`, review of the report, trial run into a scratch database,
   compare counts with the old tables, then the real run.

## 5. Decisions and open questions

1. **Duplicate email.** One email belongs to both the admin and a `ROLE_USER` account (probably one person with two
   logins). v2 allows one user per email and several organizations per user, but only one membership per organization.
   Proposal: keep **one** v2 user (the admin) and report the second account for a manual decision.
2. **1,606 document kinds.** v2 has a short list per organization. Importing all 1,606 would fill every drop-down, and
   39 names are not unique. Proposal: import only kinds that are referenced by crew documents (44 + 5 ids) plus every kind
   marked `is_license = Y` that you want, skipping the rest; when two kinds share a name, append the short name.
3. **Files.** The old tables hold only file names (for example, an average of 27 characters). The files themselves live on
   the old server's disk. The import can attach them only if that storage is reachable (a path, an S3 bucket, or a copy).
   Without it, records import **without files**, and documents with no file cannot exist in v2 (`file_path` is required),
   so those would be skipped and listed.
4. **Date of birth.** The old system collects it, v2 has an admin-only `crew_profiles.birthday` and the earlier
   decision to leave it out of the member-facing profile is still open. Proposal: import it into `birthday` only.
5. **The 55 `tb_crew_document` rows** belong to two crew ids that match no user, and none has a matching upload.
   Proposal: do not import them, list them in the report, and revisit if those crew should exist.
6. **Tasks, notifications, task comments, system logs.** No v2 counterpart. Proposal: leave them in the old database.
7. **Old app and v2 at the same time.** If both run, anything entered in the old app after the last import is picked up by
   the next run (re-runnable), but anything changed in v2 is **not** written back. We need to say which system is the
   source of truth, and from when.

## 6. What I need before building

- An empty v2 database and a database user that can write to it.
- Where the uploaded files are stored and how I can read them (or that they are not needed).
- Answers to section 5, especially 5.1, 5.2, 5.3, 5.4 and 5.7.

## 7. Dry run against the real old data (staging), 2026-10-21

Source: the staging database, read only in practice (the importer only runs SELECT); target: the local dev database,
everything rolled back (user and organization counts were identical before and after). No files folder was given.

| Entity | Would be created | Skipped |
|---|---|---|
| users, memberships, crew profiles | 3 | 2 users |
| document kinds | 5 | 0 |
| documents | 0 | 10 |
| announcements (with 1 audience group) | 1 | 0 |
| to-dos | 0 | 2 |

Why things were skipped:
- 1 user: same email as another account (the other, the administrator, is kept; it owns no documents, to-dos or announcements).
- 1 user: **no username and no email** (a crew member with a crew id), so v2 cannot sign them in. Two of their uploaded documents are skipped with them.
- 10 documents: 8 only because no files folder was given; 2 because their crew member was not imported.
- 2 to-dos: their owners' ids do not exist in the old user table at all.
- The announcement is addressed to the group `ABACUS`; as a fleet, only crew whose fleet is exactly `ABACUS` will see it, and no imported crew member has a fleet yet.

Found by this run, and fixed: a user with an empty username or email is now skipped with a reason instead of stopping the import, and a
database error no longer prints the values being written (they can contain names).

The staging database user can write (SELECT, DELETE, CREATE, ALTER); the importer's guard refuses that unless
`--allow-writable-source` is given, which was done for this dry run only, with the owner's approval.

