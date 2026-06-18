ALTER TABLE line_items ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'item';
