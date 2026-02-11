-- Backfill riwayat_kondisi_alat from existing pengembalian_detail
-- and sync sarpras.kondisi with latest return condition per asset.

insert into public.riwayat_kondisi_alat (
  sarpras_id,
  kondisi,
  deskripsi,
  sumber,
  created_by
)
select
  pd.sarpras_id,
  pd.kondisi,
  pd.deskripsi,
  'pengembalian',
  p.petugas_id
from public.pengembalian_detail pd
join public.pengembalian p on p.id = pd.pengembalian_id
where not exists (
  select 1
  from public.riwayat_kondisi_alat r
  where r.sarpras_id = pd.sarpras_id
    and r.kondisi = pd.kondisi
    and r.sumber = 'pengembalian'
    and coalesce(r.deskripsi, '') = coalesce(pd.deskripsi, '')
);

with latest_kondisi as (
  select
    pd.sarpras_id,
    pd.kondisi,
    row_number() over (
      partition by pd.sarpras_id
      order by p.tanggal_kembali_real desc nulls last
    ) as rn
  from public.pengembalian_detail pd
  join public.pengembalian p on p.id = pd.pengembalian_id
)
update public.sarpras s
set kondisi = lk.kondisi
from latest_kondisi lk
where s.id = lk.sarpras_id
  and lk.rn = 1
  and lk.kondisi <> 'hilang';
