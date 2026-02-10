-- =========================
-- RLS POLICY: PENGEMBALIAN
-- =========================

-- Petugas/Admin boleh INSERT ke pengembalian
CREATE POLICY "Petugas/Admin can insert pengembalian"
ON public.pengembalian
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin','petugas')
  )
);

-- Petugas/Admin boleh INSERT ke pengembalian_detail
CREATE POLICY "Petugas/Admin can insert pengembalian_detail"
ON public.pengembalian_detail
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin','petugas')
  )
);

-- =========================
-- STORAGE: BUCKET SARPRAS
-- =========================

-- Izinkan upload ke bucket SARPRAS
CREATE POLICY "Allow upload SARPRAS"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'SARPRAS');

-- Izinkan baca file SARPRAS (jika perlu tampil di UI)
CREATE POLICY "Allow read SARPRAS"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'SARPRAS');
