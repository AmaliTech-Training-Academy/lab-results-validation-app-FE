import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'

/**
 * Seeding for the end-to-end suite.
 *
 * <p>Two things are seeded: rows in the database, and files in the folder the backend is serving as
 * SharePoint. Both go through the same helpers so a journey can say what it needs in one line.
 *
 * <p>SQL is run with `docker exec` rather than a Node database driver, deliberately: it keeps the
 * frontend's dependency list to the two packages the suite genuinely needs, and the database is a
 * throwaway container the run owns outright.
 */

const CONTAINER = process.env.E2E_DB_CONTAINER ?? 'validata-e2e-db'
const DB_USER = process.env.E2E_DB_USER ?? 'e2e'
const DB_NAME = process.env.E2E_DB_NAME ?? 'validata_e2e'

export const DRIVE_ROOT =
  process.env.E2E_DRIVE_ROOT ?? join(process.cwd(), 'e2e', '.drive')

/** The web address prefix the backend's fixture drive answers to. Gate 1 requires this shape. */
export const WEB_BASE = 'https://fixtures.sharepoint.com/sites/validata'

/**
 * Runs one statement and returns what it selected, or an empty string.
 *
 * <p>`-q` matters: without it psql prints the command status too, so an `INSERT ... RETURNING id`
 * comes back as the id AND a trailing "INSERT 0 1". Trimming that whole thing yields a two-line
 * "id" that is silently invalid everywhere it is then used — the next insert fails with a message
 * about the *second* table, which is a long way from the actual cause.
 */
export function sql(statement: string): string {
  return execFileSync(
    'docker',
    ['exec', '-i', CONTAINER, 'psql', '-q', '-U', DB_USER, '-d', DB_NAME, '-t', '-A', '-c', statement],
    { encoding: 'utf8' },
  ).trim()
}

/**
 * An admin whose password is generated fresh for every run.
 *
 * <p>Nothing is stored in the repository: the password is random, hashed here, and only ever exists
 * in this process and the throwaway database. A committed test credential in a repo that has a
 * remote is a habit worth not starting.
 */
export function seedAdmin(mustChangePassword = false): { email: string; password: string } {
  const suffix = Math.random().toString(36).slice(2, 10)
  // The domain is not arbitrary. The LOGIN FORM enforces an allow-list — @amalitech.com,
  // @amalitechtraining.com, @amalitechtraining.org — and rejects anything else before a request is
  // ever sent. The backend has no such rule and accepts any address, so a seeded admin on a test
  // domain authenticates perfectly over the API and cannot get past the sign-in screen. That gap
  // cost an afternoon once; it is exactly the sort of thing only a browser test finds.
  const email = `e2e.admin.${suffix}@amalitechtraining.org`
  const password = `E2e!${suffix}Aa1`
  const hash = bcrypt.hashSync(password, 10)

  // Retire the previous run's admins first. Every stand-up or sync failure emails EVERY active
  // admin, so a suite that leaves its admins active turns each failure into a fan-out of dozens of
  // sends — which saturates the notification thread pool and stops the progress stream reaching the
  // screen. That looked exactly like a product defect and was not one; see e2e/README.md.
  sql(`UPDATE users SET is_active = false WHERE email LIKE 'e2e.admin.%'`)
  sql(
    `INSERT INTO users (email, password_hash, role, is_active, must_change_password)
     VALUES ('${email}', '${hash}', 'admin', true, ${mustChangePassword})`,
  )
  return { email, password }
}

/** A cohort already stood up, pointed at a folder on the fixture drive. */
export function seedStoodUpCohort(folderName: string): {
  cohortId: string
  specializationId: string
  moduleId: string
  name: string
} {
  const name = `E2E Cohort ${folderName}`
  const cohortId = sql(
    `INSERT INTO cohorts (name, start_date, end_date, lifecycle_state,
                          sharepoint_folder_url, sharepoint_drive_id, sharepoint_item_id)
     VALUES ('${name}', DATE '2026-01-01', DATE '2026-12-31', 'STOOD_UP',
             '${WEB_BASE}/${folderName}', 'fixture-drive', '${folderName}')
     RETURNING id`,
  )
  const specializationId = sql(
    `INSERT INTO specializations (cohort_id, name, code)
     VALUES ('${cohortId}', 'Backend Engineering', 'BE') RETURNING id`,
  )
  const moduleId = sql(
    `INSERT INTO modules (specialization_id, name, code, status)
     VALUES ('${specializationId}', 'Module 1', 'M1', 'active') RETURNING id`,
  )
  return { cohortId, specializationId, moduleId, name }
}

/** A cohort still in DRAFT, so the stand-up journey has something to run against. */
export function seedDraftCohort(folderName: string): { cohortId: string; name: string } {
  const name = `E2E Draft ${folderName}`
  const cohortId = sql(
    `INSERT INTO cohorts (name, start_date, end_date, lifecycle_state, sharepoint_folder_url)
     VALUES ('${name}', DATE '2026-01-01', DATE '2026-12-31', 'DRAFT', '${WEB_BASE}/${folderName}')
     RETURNING id`,
  )
  return { cohortId, name }
}

export function seedLab(moduleId: string, title: string): string {
  return sql(
    `INSERT INTO labs (module_id, title, max_score) VALUES ('${moduleId}', '${title}', 100) RETURNING id`,
  )
}

export function seedLearner(cohortId: string, specializationId: string, fullName: string): string {
  const email = `${fullName.toLowerCase().replace(/[^a-z]+/g, '.')}.${Math.random()
    .toString(36)
    .slice(2, 8)}@example.test`
  return sql(
    `INSERT INTO learners (full_name, email, cohort_id, specialization_id, status)
     VALUES ('${fullName}', '${email}', '${cohortId}', '${specializationId}', 'active') RETURNING id`,
  )
}

/**
 * A reviewer, by an exact name.
 *
 * <p>Unlike the other helpers this one does **not** add a suffix, because the name has to match the
 * `Reviewer` column of a committed spreadsheet fixture — and a fixture cannot know a random suffix.
 * `instructor_contacts` is global with a unique email and a unique name, and the database persists
 * between runs, so the insert is written to tolerate the row already being there. The assignment to
 * this cohort's specialization is new every time, which is what actually scopes the reviewer.
 */
export function seedInstructor(specializationId: string, fullName: string): string {
  const email = `${fullName.toLowerCase().replace(/[^a-z]+/g, '.')}@amalitechtraining.org`
  sql(
    `INSERT INTO instructor_contacts (email, full_name, is_active)
     VALUES ('${email}', '${fullName}', true) ON CONFLICT (email) DO NOTHING`,
  )
  const id = sql(`SELECT id FROM instructor_contacts WHERE email = '${email}'`)
  sql(
    `INSERT INTO instructor_specialization_assignments (instructor_contact_id, specialization_id)
     VALUES ('${id}', '${specializationId}')`,
  )
  return fullName
}

// ── committed spreadsheet fixtures ────────────────────────────────────────

/** Names inside the committed grading workbooks. A journey must seed these exact people. */
export const GRADING = {
  reviewer: 'Efua Danso-Mensah',
  learners: ['Adwoa Frimpong-Baah', 'Yaw Oppong-Kyei'],
  lab: 'Provisioning a Virtual Network',
} as const

const FIXTURES = join(process.cwd(), 'e2e', 'fixtures')

/** Drops one of the committed grading workbooks into a cohort's Lab Scores folder. */
export function putGradingWorkbook(folderName: string, which: 'clean' | 'rejections' | 'duplicate'): void {
  const target = join(cohortFolder(folderName), 'Lab Scores', 'Module 1 Grading.xlsx')
  cpSync(join(FIXTURES, 'grading', `${which}.xlsx`), target)
}

/** Copies the five reference workbooks Gate 3 validates into a cohort's Reference Data folder. */
export function putReferenceBundle(folderName: string, options: { omit?: string } = {}): void {
  const source = join(FIXTURES, 'reference-bundle')
  const target = join(cohortFolder(folderName), 'Reference Data')
  cpSync(source, target, { recursive: true })
  if (options.omit) rmSync(join(target, options.omit), { force: true })
}

/** A cohort seeded to match the committed grading workbooks, ready for a sync. */
export function seedCohortForGrading(folderName: string) {
  const cohort = seedStoodUpCohort(folderName)
  seedLab(cohort.moduleId, GRADING.lab)
  for (const learner of GRADING.learners) {
    seedLearner(cohort.cohortId, cohort.specializationId, learner)
  }
  seedInstructor(cohort.specializationId, GRADING.reviewer)
  makeCohortFolder(folderName)
  return cohort
}

/**
 * A completed run with rejected rows, written straight into the audit tables.
 *
 * <p>**Why the outcome is seeded rather than produced by a real sync.** These journeys are about
 * what the *screens* say about a run — that the list reports a rejection instead of a confident
 * zero, and that the dashboard notices. Producing a real run here would also require S3, which this
 * machine has no credentials for (see e2e/README.md), and would re-test ingestion rules that the
 * backend suite already covers with better failure messages. What is under test is the rendering.
 */
function errorReport(): string {
  // Built with JSON.stringify rather than written inline: an apostrophe in the message has to
  // survive both a TypeScript template literal and a SQL string literal, and hand-escaping it wrong
  // fails with a jsonb parse error that names neither of them.
  return JSON.stringify([
    {
      file: 'Module 1 Grading.xlsx',
      location: 'sheet Module-1 row 5',
      rule: 'F2-INVALID-SCORE',
      message: 'Total Score not-a-score is not numeric.',
    },
  ]).replace(/'/g, "''")
}

export function seedCompletedRunWithRejections(
  cohortId: string,
  opts: { rejected?: number; conflicts?: number } = {},
) {
  const rejected = opts.rejected ?? 1
  // Counts must be right at INSERT: ingestion_runs is append-only once finalized (a trigger refuses
  // any UPDATE unless status is still 'processing'), so there is no second chance to correct them.
  const conflicts = opts.conflicts ?? 0
  const jobId = sql(
    `INSERT INTO cohort_sync_jobs (cohort_id, status, started_at, completed_at)
     VALUES ('${cohortId}', 'COMPLETED', NOW(), NOW()) RETURNING id`,
  )
  const runId = sql(
    `INSERT INTO ingestion_runs (cohort_id, sync_job_id, workbook_filename, trigger_type, status,
                                 rows_read, committed_new, updated_count, skipped_invalid,
                                 skipped_unchanged, conflicts_count, failure_rate_percent,
                                 high_failure_rate, sharepoint_file_url, sharepoint_version_id,
                                 quick_xor_hash, error_report_json)
     VALUES ('${cohortId}', '${jobId}', 'Module 1 Grading.xlsx', 'MANUAL', 'partial',
             2, 1, 0, ${rejected}, 0, ${conflicts}, ${rejected * 50}, ${rejected > 1},
             '${WEB_BASE}/scores/Module 1 Grading.xlsx', 'c:e2e0000000000001', 'ZTJlLWhhc2g=',
             '${errorReport()}'::jsonb)
     RETURNING id`,
  )
  return { jobId, runId }
}

/** A pending duplicate held for a decision, with two candidate marks. */
export function seedPendingConflict(
  cohortId: string,
  runId: string,
  learnerId: string,
  labId: string,
) {
  const candidates = JSON.stringify({
    candidates: [
      {
        fileName: 'Module 1 Grading.xlsx', sheetName: 'Module-1', rowNum: 5,
        nspName: GRADING.learners[0], submittedOn: '2026-03-02', score: '62.00',
        instructorContactId: null,
      },
      {
        fileName: 'Module 1 Grading.xlsx', sheetName: 'Module-1', rowNum: 6,
        nspName: GRADING.learners[0], submittedOn: '2026-03-03', score: '91.00',
        instructorContactId: null,
      },
    ],
  })
  return sql(
    `INSERT INTO ingestion_conflicts (ingestion_run_id, learner_id, lab_id, conflict_kind,
                                      incoming_payload_json, status)
     VALUES ('${runId}', '${learnerId}', '${labId}', 'in_file_duplicate',
             '${candidates.replace(/'/g, "''")}'::jsonb, 'PENDING')
     RETURNING id`,
  )
}

// ── the fixture drive ─────────────────────────────────────────────────────

export function cohortFolder(folderName: string): string {
  return join(DRIVE_ROOT, folderName)
}

export function makeCohortFolder(folderName: string, withScoresFolder = true): string {
  const folder = cohortFolder(folderName)
  mkdirSync(join(folder, 'Reference Data'), { recursive: true })
  if (withScoresFolder) mkdirSync(join(folder, 'Lab Scores'), { recursive: true })
  return folder
}

export function removeFolder(folderName: string): void {
  rmSync(cohortFolder(folderName), { recursive: true, force: true })
}

export function writeText(path: string, contents: string): void {
  writeFileSync(path, contents)
}

export function resetDriveRoot(): void {
  rmSync(DRIVE_ROOT, { recursive: true, force: true })
  mkdirSync(DRIVE_ROOT, { recursive: true })
}
