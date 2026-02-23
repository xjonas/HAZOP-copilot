import {
  bigint,
  boolean,
  check,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const orgs = pgTable('orgs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  cognitoSub: text('cognito_sub').notNull().unique(),
  email: text('email').notNull().unique(),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  orgId: uuid('org_id').references(() => orgs.id),
  role: text('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('users_role_check', sql`${table.role} in ('owner', 'admin', 'member')`),
]);

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('planning'),
  processDescription: text('process_description'),
  deadline: date('deadline'),
  location: text('location'),
  responsiblePerson: text('responsible_person'),
  progress: integer('progress').notNull().default(0),
  workflowStage: text('workflow_stage'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('projects_status_check', sql`${table.status} in ('planning','active','in-progress','review','completed')`),
  check('projects_progress_check', sql`${table.progress} between 0 and 100`),
]);

export const projectFiles = pgTable('project_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  storagePath: text('storage_path').notNull(),
  mimeType: text('mime_type').notNull().default('application/pdf'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  taskType: text('task_type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('pending'),
  displayOrder: integer('display_order').notNull().default(0),
  operatingConditions: text('operating_conditions'),
  position: text('position'),
  connections: text('connections'),
  chemicals: text('chemicals'),
  designIntent: text('design_intent'),
  boundaries: text('boundaries'),
  equipmentTags: text('equipment_tags'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('tasks_type_check', sql`${table.taskType} in ('object','node')`),
]);

export const hazopRows = pgTable('hazop_rows', {
  id: uuid('id').primaryKey().defaultRandom(),
  nodeTaskId: uuid('node_task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  guideWord: text('guide_word').notNull().default(''),
  parameter: text('parameter').notNull().default(''),
  deviation: text('deviation').notNull().default(''),
  causes: text('causes').notNull().default(''),
  consequences: text('consequences').notNull().default(''),
  safeguards: text('safeguards').notNull().default(''),
  recommendations: text('recommendations').notNull().default(''),
  severity: integer('severity').notNull().default(1),
  likelihood: integer('likelihood').notNull().default(1),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('hazop_rows_severity_check', sql`${table.severity} between 1 and 5`),
  check('hazop_rows_likelihood_check', sql`${table.likelihood} between 1 and 5`),
]);

export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull().defaultNow(),
  attendees: jsonb('attendees').notNull().default(sql`'[]'::jsonb`),
  notes: text('notes').notNull().default(''),
  summary: text('summary'),
  transcript: text('transcript'),
  recording: boolean('recording').notNull().default(false),
  recordingPath: text('recording_path'),
  duration: text('duration'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
