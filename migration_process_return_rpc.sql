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
  v_kondisi_awal text;
  v_damage_detected boolean;
BEGIN
  -- Ambil sarpras_id dari detail peminjaman (asumsi 1 jenis unit per transaksi)
  SELECT pd.sarpras_id
  INTO v_sarpras_id
  FROM public.peminjaman_detail pd
  WHERE pd.peminjaman_id = p_peminjaman_id
  LIMIT 1;

  IF v_sarpras_id IS NULL THEN
    RAISE EXCEPTION 'peminjaman_detail not found for %', p_peminjaman_id;
  END IF;

  -- Ambil kondisi awal inspeksi sebelum pinjam (jika ada)
  SELECT pbi.kondisi_awal
  INTO v_kondisi_awal
  FROM public.pre_borrow_inspection pbi
  WHERE pbi.peminjaman_id = p_peminjaman_id
    AND pbi.unit_id = v_sarpras_id
  ORDER BY pbi.inspected_at DESC
  LIMIT 1;

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

    -- deteksi kerusakan default lama
    v_damage_detected := v_kondisi <> 'baik';

    -- jika ada kondisi awal, kerusakan dihitung berdasarkan penurunan tingkat kondisi
    IF v_kondisi_awal IS NOT NULL THEN
      v_damage_detected :=
        (CASE v_kondisi
          WHEN 'baik' THEN 1
          WHEN 'rusak_ringan' THEN 2
          WHEN 'rusak_berat' THEN 3
          WHEN 'hilang' THEN 4
          ELSE 1
        END)
        >
        (CASE v_kondisi_awal
          WHEN 'baik' THEN 1
          WHEN 'rusak_ringan' THEN 2
          WHEN 'rusak_berat' THEN 3
          WHEN 'hilang' THEN 4
          ELSE 1
        END);
    END IF;

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
      v_damage_detected,
      CASE
        WHEN v_kondisi = 'rusak_ringan' THEN 'ringan'
        WHEN v_kondisi = 'rusak_berat' THEN 'berat'
        ELSE NULL
      END
    );

    -- Catat riwayat kondisi aset
    INSERT INTO public.riwayat_kondisi_alat (
      sarpras_id,
      kondisi,
      deskripsi,
      sumber,
      created_by
    ) VALUES (
      v_sarpras_id,
      v_kondisi,
      v_item->>'catatan',
      'pengembalian',
      p_petugas_id
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

  -- Update kondisi terakhir sarpras berdasarkan kondisi terakhir pada verifikasi
  -- Hindari set kondisi 'hilang' jika constraint sarpras_kondisi_check tidak mengizinkan
  IF v_kondisi <> 'hilang' THEN
    UPDATE public.sarpras
    SET kondisi = v_kondisi
    WHERE id = v_sarpras_id;
  END IF;
END;
$$;
