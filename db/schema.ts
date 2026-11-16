import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const players=sqliteTable('players',{id:text('id').primaryKey(),state:text('state').notNull(),revision:integer('revision').notNull().default(0)});
export const operations=sqliteTable('operations',{playerId:text('player_id').notNull().references(()=>players.id),key:text('key').notNull(),action:text('action').notNull(),createdAt:integer('created_at').notNull()},t=>[primaryKey({columns:[t.playerId,t.key]})]);
export const pilotProfiles=sqliteTable('pilot_profiles',{
 playerId:text('player_id').primaryKey().references(()=>players.id,{onDelete:'cascade'}),
 firstSeen:integer('first_seen').notNull(),firstDay:text('first_day').notNull(),
 channel:text('channel').notNull(),isNew:integer('is_new').notNull(),
},t=>[index('pilot_profiles_cohort').on(t.channel,t.firstDay)]);
export const pilotVisits=sqliteTable('pilot_visits',{
 playerId:text('player_id').notNull().references(()=>pilotProfiles.playerId,{onDelete:'cascade'}),
 day:text('day').notNull(),firstAt:integer('first_at').notNull(),
},t=>[primaryKey({columns:[t.playerId,t.day]}),index('pilot_visits_day').on(t.day)]);
export const pilotErrors=sqliteTable('pilot_errors',{
 requestId:text('request_id').primaryKey(),playerId:text('player_id').notNull().references(()=>players.id,{onDelete:'cascade'}),
 day:text('day').notNull(),channel:text('channel').notNull(),code:text('code').notNull(),source:text('source').notNull(),occurredAt:integer('occurred_at').notNull(),
},t=>[index('pilot_errors_daily_cap').on(t.playerId,t.day),index('pilot_errors_day').on(t.day)]);
