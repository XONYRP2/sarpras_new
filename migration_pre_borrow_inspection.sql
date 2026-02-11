-- ==================================================
-- Pre-Borrow Inspection: template checklist + hasil inspeksi awal
-- ==================================================

create table if not exists public.checklist_template_item (
  id uuid primary key default gen_random_uuid(),
  kategori_id uuid not null references public.kategori(id) on delete cascade,
  item_label text not null,
  urutan integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_checklist_template_item_kategori
  on public.checklist_template_item(kategori_id);

create table if not exists public.pre_borrow_inspection (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.sarpras(id) on delete restrict,
  peminjaman_id uuid not null references public.peminjaman(id) on delete cascade,
  peminjaman_detail_id uuid not null references public.peminjaman_detail(id) on delete cascade,
  kondisi_awal text not null check (kondisi_awal in ('baik', 'rusak_ringan', 'rusak_berat', 'hilang')),
  catatan text,
  foto text,
  petugas_id uuid not null references public.profiles(id) on delete restrict,
  inspected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (peminjaman_detail_id)
);

create index if not exists idx_pre_borrow_inspection_peminjaman
  on public.pre_borrow_inspection(peminjaman_id);

create index if not exists idx_pre_borrow_inspection_unit
  on public.pre_borrow_inspection(unit_id);

create table if not exists public.pre_borrow_inspection_item (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.pre_borrow_inspection(id) on delete cascade,
  template_item_id uuid references public.checklist_template_item(id) on delete set null,
  item_label text not null,
  kondisi text not null check (kondisi in ('baik', 'rusak_ringan', 'rusak_berat', 'hilang')),
  catatan text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pre_borrow_inspection_item_inspection
  on public.pre_borrow_inspection_item(inspection_id);

alter table public.checklist_template_item enable row level security;
alter table public.pre_borrow_inspection enable row level security;
alter table public.pre_borrow_inspection_item enable row level security;

drop policy if exists "Admin/Petugas can read checklist template" on public.checklist_template_item;
create policy "Admin/Petugas can read checklist template"
on public.checklist_template_item
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'petugas')
  )
);

drop policy if exists "Admin can write checklist template" on public.checklist_template_item;
create policy "Admin can write checklist template"
on public.checklist_template_item
for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "Admin/Petugas can read pre-borrow inspection" on public.pre_borrow_inspection;
create policy "Admin/Petugas can read pre-borrow inspection"
on public.pre_borrow_inspection
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'petugas')
  )
);

drop policy if exists "Admin/Petugas can write pre-borrow inspection" on public.pre_borrow_inspection;
create policy "Admin/Petugas can write pre-borrow inspection"
on public.pre_borrow_inspection
for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'petugas')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'petugas')
  )
);

drop policy if exists "Admin/Petugas can read pre-borrow inspection item" on public.pre_borrow_inspection_item;
create policy "Admin/Petugas can read pre-borrow inspection item"
on public.pre_borrow_inspection_item
for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'petugas')
  )
);

drop policy if exists "Admin/Petugas can write pre-borrow inspection item" on public.pre_borrow_inspection_item;
create policy "Admin/Petugas can write pre-borrow inspection item"
on public.pre_borrow_inspection_item
for all
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'petugas')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'petugas')
  )
);
