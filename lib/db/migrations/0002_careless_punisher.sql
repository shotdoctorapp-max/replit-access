ALTER TABLE "waitlist" ADD COLUMN "confirmation_token" text;--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_confirmation_token_unique" UNIQUE("confirmation_token");