-- Add catatan field for pengaduan progress notes

alter table public.pengaduan
add column if not exists catatan text;
