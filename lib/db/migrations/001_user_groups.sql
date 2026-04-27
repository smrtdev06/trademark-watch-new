-- Create user groups table and link users. Run against your database once (Drizzle schema: user_groups, users.group_id).
CREATE TABLE IF NOT EXISTS "user_groups" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL UNIQUE,
  "menu_permissions" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "group_id" integer;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_group_id_user_groups_id_fk'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_group_id_user_groups_id_fk"
      FOREIGN KEY ("group_id") REFERENCES "user_groups"("id") ON DELETE SET NULL;
  END IF;
END
$$;
