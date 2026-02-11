'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { uploadImage } from '@/lib/storage'

interface TemplateItem {
  id: string
  kategori_id: string
  item_label: string
  urutan: number
}

interface LoanDetail {
  id: string
  peminjaman_id: string
  jumlah: number
  sarpras: {
    id: string
    nama: string
    kode: string
    kategori_id: string | null
  }
}

interface Loan {
  id: string
  kode_peminjaman: string
  status: string
  profiles?: { nama_lengkap: string }
  peminjaman_detail: LoanDetail[]
}

type LoanRow = Omit<Loan, 'profiles' | 'peminjaman_detail'> & {
  profiles: { nama_lengkap: string }[] | { nama_lengkap: string } | null
  peminjaman_detail: Array<Omit<LoanDetail, 'sarpras'> & { sarpras: LoanDetail['sarpras'][] | LoanDetail['sarpras'] | null }>
}

function normalizeLoanRows(rows: LoanRow[]): Loan[] {
  return rows.map((row) => ({
    id: row.id,
    kode_peminjaman: row.kode_peminjaman,
    status: row.status,
    profiles: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles || undefined,
    peminjaman_detail: (row.peminjaman_detail || []).map((detail) => ({
      id: detail.id,
      peminjaman_id: detail.peminjaman_id,
      jumlah: detail.jumlah,
      sarpras: Array.isArray(detail.sarpras) ? detail.sarpras[0] : (detail.sarpras as LoanDetail['sarpras']),
    })),
  }))
}

interface ChecklistInput {
  template_item_id: string
  item_label: string
  kondisi: 'baik' | 'rusak_ringan' | 'rusak_berat' | 'hilang'
  catatan: string
}

interface InspectionRow {
  peminjaman_detail_id: string
}

const KONDISI_OPTIONS: ChecklistInput['kondisi'][] = ['baik', 'rusak_ringan', 'rusak_berat', 'hilang']

export default function InspeksiAwalPage() {
  const router = useRouter()
  const [loanParam, setLoanParam] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loans, setLoans] = useState<Loan[]>([])
  const [templatesByKategori, setTemplatesByKategori] = useState<Record<string, TemplateItem[]>>({})
  const [inspectionDoneDetailIds, setInspectionDoneDetailIds] = useState<Record<string, boolean>>({})
  const [activeDetail, setActiveDetail] = useState<LoanDetail | null>(null)
  const [activeLoan, setActiveLoan] = useState<Loan | null>(null)
  const [kondisiAwal, setKondisiAwal] = useState<ChecklistInput['kondisi']>('baik')
  const [catatan, setCatatan] = useState('')
  const [checklistInputs, setChecklistInputs] = useState<ChecklistInput[]>([])
  const [fotoFile, setFotoFile] = useState<File | null>(null)

  const fetchData = async () => {
    try {
      const profileId = localStorage.getItem('profileId')
      if (!profileId) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', profileId).single()
      if (!profile || !['admin', 'petugas'].includes(profile.role)) {
        router.push('/dashboard')
        return
      }

      const { data: loanData, error: loanError } = await supabase
        .from('peminjaman')
        .select(`
          id,
          kode_peminjaman,
          status,
          profiles:user_id(nama_lengkap),
          peminjaman_detail(
            id,
            peminjaman_id,
            jumlah,
            sarpras:sarpras_id(id, nama, kode, kategori_id)
          )
        `)
        .eq('status', 'disetujui')
        .order('created_at', { ascending: false })

      if (loanError) throw loanError
      const list: Loan[] = Array.isArray(loanData) ? normalizeLoanRows(loanData as LoanRow[]) : []
      setLoans(list)

      const kategoriIds = Array.from(
        new Set(
          list
            .flatMap((l) => l.peminjaman_detail || [])
            .map((d) => d.sarpras?.kategori_id)
            .filter(Boolean)
        )
      ) as string[]

      if (kategoriIds.length > 0) {
        const { data: templateItems } = await supabase
          .from('checklist_template_item')
          .select('id, kategori_id, item_label, urutan')
          .in('kategori_id', kategoriIds)
          .eq('is_active', true)
          .order('urutan', { ascending: true })

        const grouped: Record<string, TemplateItem[]> = {}
        ;(templateItems as TemplateItem[] | null || []).forEach((item) => {
          if (!grouped[item.kategori_id]) grouped[item.kategori_id] = []
          grouped[item.kategori_id].push(item)
        })
        setTemplatesByKategori(grouped)
      }

      const detailIds = list.flatMap((l) => l.peminjaman_detail || []).map((d) => d.id)
      if (detailIds.length > 0) {
        const { data: inspections } = await supabase
          .from('pre_borrow_inspection')
          .select('peminjaman_detail_id')
          .in('peminjaman_detail_id', detailIds)

        const doneMap: Record<string, boolean> = {}
        ;(inspections as InspectionRow[] | null || []).forEach((ins) => {
          doneMap[ins.peminjaman_detail_id] = true
        })
        setInspectionDoneDetailIds(doneMap)
      }

      if (loanParam) {
        const foundLoan = list.find((l) => l.id === loanParam)
        const foundDetail = foundLoan?.peminjaman_detail?.find((d) => !inspectionDoneDetailIds[d.id]) || foundLoan?.peminjaman_detail?.[0]
        if (foundLoan && foundDetail) {
          openInspectionForm(foundLoan, foundDetail, templatesByKategori)
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setLoanParam(params.get('loan'))
  }, [])

  useEffect(() => {
    fetchData()
  }, [router, loanParam])

  const openInspectionForm = (
    loan: Loan,
    detail: LoanDetail,
    mapTemplate?: Record<string, TemplateItem[]>
  ) => {
    const source = mapTemplate || templatesByKategori
    const template = source[detail.sarpras?.kategori_id || ''] || []
    const initChecklist: ChecklistInput[] = template.map((t) => ({
      template_item_id: t.id,
      item_label: t.item_label,
      kondisi: 'baik',
      catatan: '',
    }))

    setActiveLoan(loan)
    setActiveDetail(detail)
    setKondisiAwal('baik')
    setCatatan('')
    setChecklistInputs(initChecklist)
    setFotoFile(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const checklistSummary = useMemo(() => checklistInputs.length, [checklistInputs])

  const updateChecklist = (index: number, field: keyof ChecklistInput, value: string) => {
    setChecklistInputs((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const saveInspection = async () => {
    if (!activeLoan || !activeDetail) return

    if (checklistInputs.length === 0) {
      if (!confirm('Template checklist kategori ini kosong. Simpan inspeksi tanpa checklist?')) return
    }

    setIsSaving(true)
    try {
      const profileId = localStorage.getItem('profileId')
      if (!profileId) throw new Error('User tidak ditemukan')

      let fotoUrl: string | null = null
      if (fotoFile) {
        const ext = fotoFile.name.split('.').pop() || 'jpg'
        const path = `pre-borrow/${activeLoan.id}/${activeDetail.id}-${Date.now()}.${ext}`
        fotoUrl = await uploadImage({ bucket: 'SARPRAS', path, file: fotoFile })
      }

      const itemsPayload = checklistInputs.map((item) => ({
        template_item_id: item.template_item_id,
        item_label: item.item_label,
        kondisi: item.kondisi,
        catatan: item.catatan.trim() || null,
      }))

      const { error: insertError } = await supabase.rpc('create_pre_borrow_inspection', {
        p_unit_id: activeDetail.sarpras.id,
        p_peminjaman_id: activeLoan.id,
        p_peminjaman_detail_id: activeDetail.id,
        p_kondisi_awal: kondisiAwal,
        p_catatan: catatan.trim() || null,
        p_foto: fotoUrl,
        p_petugas_id: profileId,
        p_items: itemsPayload.length > 0 ? itemsPayload : null,
      })

      if (insertError) throw insertError

      // jika semua detail pada peminjaman sudah diinspeksi, update jadi dipinjam
      const { data: allDetail } = await supabase
        .from('peminjaman_detail')
        .select('id')
        .eq('peminjaman_id', activeLoan.id)

      const { data: allInspection } = await supabase
        .from('pre_borrow_inspection')
        .select('peminjaman_detail_id')
        .eq('peminjaman_id', activeLoan.id)

      const detailCount = (allDetail || []).length
      const inspectedCount = new Set((allInspection as InspectionRow[] | null || []).map((x) => x.peminjaman_detail_id)).size

      if (detailCount > 0 && inspectedCount >= detailCount) {
        await supabase
          .from('peminjaman')
          .update({ status: 'dipinjam' })
          .eq('id', activeLoan.id)
      }

      alert('Inspeksi awal berhasil disimpan')
      setInspectionDoneDetailIds((prev) => ({ ...prev, [activeDetail.id]: true }))
      setActiveDetail(null)
      setActiveLoan(null)
      setChecklistInputs([])
      await fetchData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
      alert('Gagal simpan inspeksi: ' + message)
    } finally {
      setIsSaving(false)
    }
  }

  const rows = loans.flatMap((loan) =>
    (loan.peminjaman_detail || []).map((detail) => ({
      loan,
      detail,
      done: !!inspectionDoneDetailIds[detail.id],
    }))
  )

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Inspeksi Awal Peminjaman</h1>
        <p className="text-gray-500 mt-2">Checklist dinamis per kategori barang sebelum unit dipinjam.</p>
      </div>

      {activeDetail && activeLoan && (
        <Card className="border-blue-100">
          <CardHeader>
            <CardTitle>
              Form Inspeksi: {activeDetail.sarpras.nama} ({activeDetail.sarpras.kode})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-500">Kode Peminjaman</label>
                <p className="font-mono font-bold text-blue-600">{activeLoan.kode_peminjaman}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Peminjam</label>
                <p className="font-medium">{activeLoan.profiles?.nama_lengkap || '-'}</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500">Kondisi Umum Unit</label>
              <select
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={kondisiAwal}
                onChange={(e) => setKondisiAwal(e.target.value as ChecklistInput['kondisi'])}
              >
                {KONDISI_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold">Checklist ({checklistSummary} item)</div>
              {checklistInputs.length === 0 ? (
                <div className="text-sm text-gray-500">Template checklist kategori ini belum ada.</div>
              ) : (
                checklistInputs.map((item, idx) => (
                  <div key={`${item.template_item_id}-${idx}`} className="rounded-lg border p-3 space-y-2">
                    <div className="font-medium text-sm">{idx + 1}. {item.item_label}</div>
                    <div className="grid md:grid-cols-2 gap-2">
                      <select
                        className="rounded-md border px-3 py-2"
                        value={item.kondisi}
                        onChange={(e) => updateChecklist(idx, 'kondisi', e.target.value)}
                      >
                        {KONDISI_OPTIONS.map((k) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                      <Input
                        placeholder="Catatan item (opsional)"
                        value={item.catatan}
                        onChange={(e) => updateChecklist(idx, 'catatan', e.target.value)}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500">Catatan Inspeksi</label>
              <Textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan umum (opsional)" />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500">Foto Kondisi Awal (Opsional)</label>
              <Input type="file" accept="image/*" onChange={(e) => setFotoFile(e.target.files?.[0] || null)} />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setActiveDetail(null); setActiveLoan(null) }}>
                Batal
              </Button>
              <Button onClick={saveInspection} disabled={isSaving}>
                {isSaving ? 'Menyimpan...' : 'Simpan Inspeksi'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Daftar Peminjaman Disetujui (Belum Dipinjam)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-3 px-3 text-left">Kode</th>
                <th className="py-3 px-3 text-left">Peminjam</th>
                <th className="py-3 px-3 text-left">Barang</th>
                <th className="py-3 px-3 text-left">Checklist</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">Tidak ada data untuk inspeksi.</td>
                </tr>
              ) : (
                rows.map((row) => {
                  const templateCount = templatesByKategori[row.detail.sarpras.kategori_id || '']?.length || 0
                  return (
                    <tr key={row.detail.id} className="border-b">
                      <td className="py-3 px-3 font-mono text-blue-600">{row.loan.kode_peminjaman}</td>
                      <td className="py-3 px-3">{row.loan.profiles?.nama_lengkap || '-'}</td>
                      <td className="py-3 px-3">{row.detail.sarpras.nama}</td>
                      <td className="py-3 px-3">{templateCount} item</td>
                      <td className="py-3 px-3 text-right">
                        {row.done ? (
                          <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded-full">Sudah</span>
                        ) : (
                          <Button size="sm" onClick={() => openInspectionForm(row.loan, row.detail)}>
                            Inspeksi
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
