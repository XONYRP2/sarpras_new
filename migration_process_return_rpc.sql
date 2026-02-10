-- ==================================================
-- RPC: Process Return (Bypasses RLS with SECURITY DEFINER)
-- ==================================================

CREATE OR REPLACE FUNCTION public.process_return(
  p_peminjaman_id uuid,
  p_petugas_id uuid,
  p_verifications jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pengembalian_id uuid;
  v_sarpras_id uuid;
  v_total_returned integer := 0;
  v_catatan text := '';
  v_item jsonb;
  v_kondisi text;
  v_jumlah integer;
  v_foto text;
BEGIN
  -- Ambil sarpras_id dari detail peminjaman
  SELECT pd.sarpras_id
  INTO v_sarpras_id
  FROM public.peminjaman_detail pd
  WHERE pd.peminjaman_id = p_peminjaman_id
  LIMIT 1;

  IF v_sarpras_id IS NULL THEN
    RAISE EXCEPTION 'peminjaman_detail not found for %', p_peminjaman_id;
  END IF;

  -- Insert pengembalian (catatan diupdate setelah loop)
  INSERT INTO public.pengembalian (peminjaman_id, petugas_id, tanggal_kembali_real, catatan)
  VALUES (p_peminjaman_id, p_petugas_id, now(), '')
  RETURNING id INTO v_pengembalian_id;

  -- Loop verifications
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_verifications)
  LOOP
    v_kondisi := v_item->>'kondisi';
    v_jumlah := COALESCE((v_item->>'jumlah')::int, 0);
    v_foto := v_item->>'foto';

    v_catatan := v_catatan || '[' || upper(v_kondisi) || ' - ' || v_jumlah || '] ' ||
      COALESCE(v_item->>'catatan', '') || E'\n';

    INSERT INTO public.pengembalian_detail (
      pengembalian_id,
      sarpras_id,
      jumlah,
      kondisi,
      deskripsi,
      foto,
      damage_detected,
      kategori_kerusakan
    ) VALUES (
      v_pengembalian_id,
      v_sarpras_id,
      v_jumlah,
      v_kondisi,
      v_item->>'catatan',
      v_foto,
      v_kondisi <> 'baik',
      CASE
        WHEN v_kondisi = 'cacat' THEN 'ringan'
        WHEN v_kondisi = 'rusak' THEN 'berat'
        ELSE NULL
      END
    );

    IF v_kondisi <> 'hilang' THEN
      v_total_returned := v_total_returned + v_jumlah;
    END IF;
  END LOOP;

  UPDATE public.pengembalian
  SET catatan = trim(both from v_catatan)
  WHERE id = v_pengembalian_id;

  UPDATE public.peminjaman
  SET status = 'dikembalikan',
      tanggal_kembali_real = now()
  WHERE id = p_peminjaman_id;

  IF v_total_returned > 0 THEN
    UPDATE public.sarpras
    SET stok_tersedia = COALESCE(stok_tersedia, 0) + v_total_returned
    WHERE id = v_sarpras_id;
  END IF;
END;
$$;
