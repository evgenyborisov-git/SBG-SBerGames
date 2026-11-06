import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const players=sqliteTable('players',{id:text('id').primaryKey(),state:text('state').notNull(),revision:integer('revision').notNull().default(0)});
export const operations=sqliteTable('operations',{playerId:text('player_id').notNull().references(()=>players.id),key:text('key').notNull(),action:text('action').notNull(),createdAt:integer('created_at').notNull()},t=>[primaryKey({columns:[t.playerId,t.key]})]);
