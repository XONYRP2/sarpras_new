-- Add columns to peminjaman table to track borrowed items
ALTER TABLE peminjaman ADD COLUMN IF NOT EXISTS sarpras_id UUID REFERENCES sarpras(id) ON DELETE SET NULL;
ALTER TABLE peminjaman ADD COLUMN IF NOT EXISTS jumlah INTEGER DEFAULT 1;
