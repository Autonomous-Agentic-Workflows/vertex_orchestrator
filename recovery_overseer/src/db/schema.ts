import { pgTable, serial, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table synced with Firebase Auth UID
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoUrl: text('photo_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Spark Notebooks saved in Cloud SQL
export const notebooks = pgTable('notebooks', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => users.uid),
  title: text('title').notNull(),
  code: text('code').notNull(),
  mode: text('mode').notNull().default('pyspark'), // 'pyspark' | 'sql'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Saved Spark Queries
export const savedQueries = pgTable('saved_queries', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => users.uid),
  name: text('name').notNull(),
  queryText: text('query_text').notNull(),
  executionTimeMs: integer('execution_time_ms'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Imported Google Drive Files metadata
export const driveImports = pgTable('drive_imports', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => users.uid),
  fileId: text('file_id').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type'),
  importedAt: timestamp('imported_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  notebooks: many(notebooks),
  savedQueries: many(savedQueries),
  driveImports: many(driveImports),
}));

export const notebooksRelations = relations(notebooks, ({ one }) => ({
  author: one(users, {
    fields: [notebooks.userId],
    references: [users.uid],
  }),
}));
