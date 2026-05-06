CREATE TABLE "bug_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"message" text NOT NULL,
	"device_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
