-- ==================================================
-- RPC: Create Pre-Borrow Inspection (Bypasses RLS)
-- ==================================================

CREATE OR REPLACE FUNCTION public.create_pre_borrow_inspection(
  p_unit_id uuid,
  p_peminjaman_id uuid,
  p_peminjaman_detail_id uuid,
  p_kondisi_awal text,
  p_catatan text,
  p_foto text,
  p_petugas_id uuid,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inspection_id uuid;
  v_item jsonb;
BEGIN
  INSERT INTO public.pre_borrow_inspection (
    unit_id,
    peminjaman_id,
    peminjaman_detail_id,
    kondisi_awal,
    catatan,
    foto,
    petugas_id,
    inspected_at
  ) VALUES (
    p_unit_id,
    p_peminjaman_id,
    p_peminjaman_detail_id,
    p_kondisi_awal,
    p_catatan,
    p_foto,
    p_petugas_id,
    now()
  )
  RETURNING id INTO v_inspection_id;

  IF p_items IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      INSERT INTO public.pre_borrow_inspection_item (
        inspection_id,
        template_item_id,
        item_label,
        kondisi,
        catatan
      ) VALUES (
        v_inspection_id,
        (v_item->>'template_item_id')::uuid,
        v_item->>'item_label',
        v_item->>'kondisi',
        v_item->>'catatan'
      );
    END LOOP;
  END IF;

  RETURN v_inspection_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_pre_borrow_inspection(
  uuid, uuid, uuid, text, text, text, uuid, jsonb
) TO anon, authenticated;
