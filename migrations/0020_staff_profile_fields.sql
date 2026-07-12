-- Sprint 2 Staff foundation fields. Existing rows remain NULL.
ALTER TABLE staff_members ADD COLUMN avatar_url TEXT;
ALTER TABLE staff_members ADD COLUMN phone TEXT;
ALTER TABLE staff_members ADD COLUMN email TEXT;