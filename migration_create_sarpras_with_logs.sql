-- Create sarpras with initial stock and condition logs
-- Requires: tables sarpras, stok_history, riwayat_kondisi_alat

CREATE OR REPLACE FUNCTION public.create_sarpras_with_initial_logs(
  p_kode text,
  p_nama text,
  p_kategori_id uuid,
  p_lokasi_id uuid,
  p_stok_total integer,
  p_stok_tersedia integer,
  p_kondisi text,
  p_merk text,
  p_foto text,
  p_created_by uuid
)
RETURNS public.sarpras
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sarpras public.sarpras;
BEGIN
  INSERT INTO public.sarpras (
    kode,
    nama,
    kategori_id,
    lokasi_id,
    stok_total,
    stok_tersedia,
    kondisi,
    merk,
    foto,
    is_active
  )
  VALUES (
    p_kode,
    p_nama,
    p_kategori_id,
    p_lokasi_id,
    COALESCE(p_stok_total, 0),
    COALESCE(p_stok_tersedia, 0),
    p_kondisi,
    p_merk,
    p_foto,
    true
  )
  RETURNING * INTO v_sarpras;

  -- Log stok awal
  INSERT INTO public.stok_history (
    sarpras_id,
    jenis_transaksi,
    jumlah,
    stok_sebelum,
    stok_sesudah,
    keterangan,
    referensi_id,
    created_by
  ) VALUES (
    v_sarpras.id,
    'masuk',
    COALESCE(p_stok_tersedia, 0),
    0,
    COALESCE(p_stok_tersedia, 0),
    'Stok awal',
    v_sarpras.id,
    p_created_by
  );

  -- Log kondisi awal
  INSERT INTO public.riwayat_kondisi_alat (
    sarpras_id,
    kondisi,
    deskripsi,
    sumber,
    created_by
  ) VALUES (
    v_sarpras.id,
    p_kondisi,
    'Kondisi awal',
    'initial',
    p_created_by
  );

  RETURN v_sarpras;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_sarpras_with_initial_logs(
  text, text, uuid, uuid, integer, integer, text, text, text, uuid
) TO anon, authenticated;
