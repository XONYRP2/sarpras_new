-- ==================================================
-- RLS Fix: allow anon/authenticated for inspection tables
-- ==================================================

-- checklist_template_item
DROP POLICY IF EXISTS "Admin/Petugas can read checklist template" ON public.checklist_template_item;
DROP POLICY IF EXISTS "Admin can write checklist template" ON public.checklist_template_item;

CREATE POLICY "Checklist template read all"
ON public.checklist_template_item
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Checklist template write all"
ON public.checklist_template_item
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- pre_borrow_inspection
DROP POLICY IF EXISTS "Admin/Petugas can read pre-borrow inspection" ON public.pre_borrow_inspection;
DROP POLICY IF EXISTS "Admin/Petugas can write pre-borrow inspection" ON public.pre_borrow_inspection;

CREATE POLICY "Pre-borrow inspection read all"
ON public.pre_borrow_inspection
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Pre-borrow inspection write all"
ON public.pre_borrow_inspection
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- pre_borrow_inspection_item
DROP POLICY IF EXISTS "Admin/Petugas can read pre-borrow inspection item" ON public.pre_borrow_inspection_item;
DROP POLICY IF EXISTS "Admin/Petugas can write pre-borrow inspection item" ON public.pre_borrow_inspection_item;

CREATE POLICY "Pre-borrow inspection item read all"
ON public.pre_borrow_inspection_item
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Pre-borrow inspection item write all"
ON public.pre_borrow_inspection_item
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
