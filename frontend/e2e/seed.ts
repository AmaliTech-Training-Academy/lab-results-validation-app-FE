import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
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

export function sql(statement: string): string {
  return execFileSync(
    'docker',
    ['exec', '-i', CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-t', '-A', '-c', statement],
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
 * A reviewer. instructor_contacts is global with a unique email AND a unique name, so both carry a
 * per-run suffix — sharing either between journeys fails on the second insert.
 */
export function seedInstructor(specializationId: string, baseName: string): string {
  const suffix = Math.random().toString(36).slice(2, 8)
  const fullName = `${baseName} ${suffix}`
  const id = sql(
    `INSERT INTO instructor_contacts (email, full_name, is_active)
     VALUES ('inst.${suffix}@example.test', '${fullName}', true) RETURNING id`,
  )
  sql(
    `INSERT INTO instructor_specialization_assignments (instructor_contact_id, specialization_id)
     VALUES ('${id}', '${specializationId}')`,
  )
  return fullName
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
