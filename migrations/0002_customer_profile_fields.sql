-- BookingOS D1 schema v0.2
-- Extra customer registration fields before LINE Login integration.

ALTER TABLE customers ADD COLUMN email TEXT;
ALTER TABLE customers ADD COLUMN gender TEXT;
ALTER TABLE customers ADD COLUMN address TEXT;
ALTER TABLE customers ADD COLUMN preferred_service TEXT;
ALTER TABLE customers ADD COLUMN allergy_note TEXT;
ALTER TABLE customers ADD COLUMN contact_preference TEXT DEFAULT 'phone';
