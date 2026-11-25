ALTER TABLE "matches_history" DROP CONSTRAINT IF EXISTS "matches_history_currency_check";
--> statement-breakpoint
ALTER TABLE "matches_history" ADD CONSTRAINT "matches_history_currency_check" CHECK (currency IN ('COINS', 'GEL'));
--> statement-breakpoint
ALTER TABLE "match_settlements" DROP CONSTRAINT IF EXISTS "match_settlements_currency_check";
--> statement-breakpoint
ALTER TABLE "match_settlements" ADD CONSTRAINT "match_settlements_currency_check" CHECK (currency IN ('COINS', 'GEL'));
