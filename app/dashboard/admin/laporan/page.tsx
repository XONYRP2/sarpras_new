"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, AlertTriangle, CheckCircle, Package, XCircle } from "lucide-react"

interface Sarpras {
  id: string
  nama: string
  kode: string
  kondisi: string
  lokasi_id: string | null
  is_active?: boolean | null
}

interface Lokasi {
  id: string
  nama_lokasi: string
}

interface RiwayatKondisi {
  id: string
  tanggal: string
  kondisi: string
  deskripsi: string | null
  sarpras: Sarpras | null
}

interface PengaduanItem {
  sarpras_id: string | null
}

interface PengembalianKondisiRow {
  kondisi: string
  jumlah: number
  sarpras: Sarpras | null
}

interface RiwayatKondisiRaw {
  id: string
  tanggal: string
  kondisi: string
  deskripsi: string | null
  sarpras: Sarpras | Sarpras[] | null
}

interface PengembalianKondisiRowRaw {
  kondisi: string
  jumlah: number
  sarpras: Sarpras | Sarpras[] | null
}

export default function LaporanAssetPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [sarprasList, setSarprasList] = useState<Sarpras[]>([])
  const [lokasiMap, setLokasiMap] = useState<Record<string, Lokasi>>({})
  const [riwayatList, setRiwayatList] = useState<RiwayatKondisi[]>([])
  const [topIssues, setTopIssues] = useState<{ sarpras: Sarpras; count: number }[]>([])
  const [lostCount, setLostCount] = useState(0)
  const [lostSarpras, setLostSarpras] = useState<Sarpras[]>([])
  const [returnStats, setReturnStats] = useState({
    baik: 0,
    rusakRingan: 0,
    rusakBerat: 0,
    hilang: 0,
    total: 0,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const profileId = localStorage.getItem("profileId")
        if (!profileId) {
          router.push("/sign-in")
          return
        }

        const { data: profile, error: roleError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", profileId)
          .single()

        if (roleError || !profile || profile.role !== "admin") {
          router.push("/dashboard")
          return
        }

        const [
          { data: sarprasData },
          { data: lokasiData },
          { data: riwayatData },
          { data: pengaduanData },
          { data: lostHistory },
          { data: returnDetail },
        ] = await Promise.all([
          supabase
            .from("sarpras")
            .select("id, nama, kode, kondisi, lokasi_id, is_active")
            .order("nama", { ascending: true }),
          supabase.from("lokasi").select("id, nama_lokasi"),
          supabase
            .from("riwayat_kondisi_alat")
            .select(
              "id, tanggal, kondisi, deskripsi, sarpras:sarpras_id (id, nama, kode, kondisi, lokasi_id)"
            )
            .order("tanggal", { ascending: false })
            .limit(10),
          supabase.from("pengaduan").select("sarpras_id"),
          supabase.from("riwayat_kondisi_alat").select("id", { count: "exact", head: true }).eq("kondisi", "hilang"),
          supabase
            .from("pengembalian_detail")
            .select("kondisi, jumlah, sarpras:sarpras_id (id, nama, kode, kondisi, lokasi_id)"),
        ])

        setSarprasList((sarprasData as Sarpras[]) || [])

        const lokasi = (lokasiData as Lokasi[]) || []
        const lokasiLookup: Record<string, Lokasi> = {}
        lokasi.forEach((l) => {
          lokasiLookup[l.id] = l
        })
        setLokasiMap(lokasiLookup)

        const normalizedRiwayat = ((riwayatData as RiwayatKondisiRaw[]) || []).map((item) => ({
          ...item,
          sarpras: Array.isArray(item.sarpras) ? item.sarpras[0] ?? null : item.sarpras ?? null,
        }))
        setRiwayatList(normalizedRiwayat)
        setLostCount(lostHistory?.length ?? 0)

        const rows = ((returnDetail as PengembalianKondisiRowRaw[]) || []).map((item) => ({
          ...item,
          sarpras: Array.isArray(item.sarpras) ? item.sarpras[0] ?? null : item.sarpras ?? null,
        }))
        const baik = rows.filter((r) => r.kondisi === "baik").length
        const rusakRingan = rows.filter((r) => r.kondisi === "rusak_ringan").length
        const rusakBerat = rows.filter((r) => r.kondisi === "rusak_berat").length
        const hilang = rows.filter((r) => r.kondisi === "hilang").length
        const total = rows.length
        setReturnStats({ baik, rusakRingan, rusakBerat, hilang, total })

        const lostMap = new Map<string, Sarpras>()
        rows.forEach((r) => {
          if (r.kondisi !== "hilang") return
          if (r.sarpras?.id) lostMap.set(r.sarpras.id, r.sarpras)
        })
        setLostSarpras(Array.from(lostMap.values()))

        const counts: Record<string, number> = {}
        ;(pengaduanData as PengaduanItem[] | null)?.forEach((p) => {
          if (!p.sarpras_id) return
          counts[p.sarpras_id] = (counts[p.sarpras_id] || 0) + 1
        })
        const top = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id, count]) => {
            const s = (sarprasData as Sarpras[] | null)?.find((item) => item.id === id)
            return s ? { sarpras: s, count } : null
          })
          .filter(Boolean) as { sarpras: Sarpras; count: number }[]
        setTopIssues(top)
      } catch (err) {
        console.error("Error fetching asset report:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  const stats = useMemo(() => {
        const total = sarprasList.length
        const totalAktif = sarprasList.filter((s) => s.is_active !== false).length
        const perluPerbaikan = returnStats.rusakRingan + returnStats.rusakBerat
        return { total, totalAktif, perluPerbaikan }
    }, [sarprasList])

  const donutStops = useMemo(() => {
    const total = returnStats.total || 1
    const baikPct = (returnStats.baik / total) * 100
    const rusakRinganPct = (returnStats.rusakRingan / total) * 100
    const rusakBeratPct = (returnStats.rusakBerat / total) * 100
    const hilangPct = (returnStats.hilang / total) * 100
    return { baikPct, rusakRinganPct, rusakBeratPct, hilangPct }
  }, [returnStats])

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <Activity className="h-3.5 w-3.5" />
            Real-time Data
          </div>
          <h1 className="mt-3 text-3xl font-bold text-gray-900">Analitik Kesehatan Aset</h1>
          <p className="text-gray-600 mt-2 max-w-2xl">
            Insight mendalam tentang kondisi fisik dan keberlanjutan sarana prasarana.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="p-5 border border-blue-100 bg-gradient-to-br from-blue-50 to-white">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-blue-700">Total Aset</div>
            <Package className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-3 text-3xl font-bold text-blue-900">{stats.total}</div>
          <div className="mt-2 text-xs text-blue-600">Total: {stats.total} • Aktif: {stats.totalAktif}</div>
        </Card>
        <Card className="p-5 border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-emerald-700">Kondisi Sempurna</div>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-3 text-3xl font-bold text-emerald-700">{returnStats.baik}</div>
          <div className="mt-2 text-xs text-emerald-600">Berdasarkan riwayat pengembalian</div>
        </Card>
        <Card className="p-5 border border-amber-100 bg-gradient-to-br from-amber-50 to-white">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-amber-700">Butuh Perbaikan</div>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-3 text-3xl font-bold text-amber-700">{stats.perluPerbaikan}</div>
          <div className="mt-2 text-xs text-amber-600">Berdasarkan riwayat pengembalian</div>
        </Card>
        <Card className="p-5 border border-rose-100 bg-gradient-to-br from-rose-50 to-white">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-rose-700">Aset Hilang</div>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-3 text-3xl font-bold text-rose-700">{returnStats.hilang}</div>
          <div className="mt-2 text-xs text-rose-600">Berdasarkan riwayat pengembalian</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Distribusi Kondisi Aset</h3>
              <p className="text-xs text-gray-500 mt-1">Persentase kondisi aset saat ini.</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="relative h-44 w-44 rounded-full"
              style={{
                background: `conic-gradient(#10b981 0% ${donutStops.baikPct}%,
                  #f59e0b ${donutStops.baikPct}% ${donutStops.baikPct + donutStops.rusakRinganPct}%,
                  #ef4444 ${donutStops.baikPct + donutStops.rusakRinganPct}% ${donutStops.baikPct + donutStops.rusakRinganPct + donutStops.rusakBeratPct}%,
                  #e5e7eb ${donutStops.baikPct + donutStops.rusakRinganPct + donutStops.rusakBeratPct}% 100%)`,
              }}
            >
              <div className="absolute inset-5 rounded-full bg-white shadow-sm"></div>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-gray-700">
                {stats.total} Aset
              </div>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500"></span>
                Baik ({returnStats.baik})
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-500"></span>
                Rusak Ringan ({returnStats.rusakRingan})
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500"></span>
                Rusak Berat ({returnStats.rusakBerat})
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-gray-300"></span>
                Hilang ({returnStats.hilang})
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Aset Paling Sering Bermasalah</h3>
              <p className="text-xs text-gray-500 mt-1">Top 5 aset dengan frekuensi pengaduan tertinggi.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {topIssues.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                Belum ada data kerusakan.
              </div>
            ) : (
              topIssues.map((item, idx) => (
                <div key={item.sarpras.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 font-semibold">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{item.sarpras.nama}</div>
                      <div className="text-xs text-gray-500 font-mono">{item.sarpras.kode}</div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-red-700 bg-red-50 px-2 py-1 rounded-full">
                    {item.count} pengaduan
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="p-6 border border-rose-100 bg-gradient-to-br from-rose-50 to-white">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-rose-900">Aset Hilang</h3>
            <p className="text-xs text-rose-700 mt-1">Daftar aset yang ditandai hilang (tidak bisa dipinjam).</p>
          </div>
          <XCircle className="h-5 w-5 text-rose-500" />
        </div>
        <div className="mt-4 space-y-3">
          {lostSarpras.length === 0 ? (
            <div className="rounded-lg border border-dashed border-rose-200 p-4 text-center text-sm text-rose-700">
              Tidak ada aset hilang.
            </div>
          ) : (
            lostSarpras.map((item) => {
              const lokasi = item.lokasi_id ? lokasiMap[item.lokasi_id] : null
              return (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-rose-200 bg-white p-3">
                  <div>
                    <div className="text-sm font-semibold text-rose-900">{item.nama}</div>
                    <div className="text-xs text-rose-700 font-mono">{item.kode}</div>
                    <div className="text-xs text-rose-600">{lokasi?.nama_lokasi || '-'}</div>
                  </div>
                  <span className="text-[10px] font-semibold uppercase rounded-full bg-rose-100 px-2 py-1 text-rose-700">
                    Hilang
                  </span>
                </div>
              )
            })
          )}
        </div>
      </Card>

      <Card className="overflow-hidden border border-gray-100">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
          <div className="text-sm font-semibold text-gray-700">Riwayat Perubahan Kondisi Aset</div>
          <div className="text-xs text-gray-500">Menampilkan {riwayatList.length} data terbaru</div>
        </div>
        <div className="overflow-x-auto">
          {riwayatList.length === 0 ? (
            <div className="p-6 text-center text-gray-600">Belum ada riwayat kondisi.</div>
          ) : (
            <table className="w-full">
              <thead className="border-b border-gray-100 bg-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tanggal</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Aset / Kode</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Kondisi</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Lokasi</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {riwayatList.map((item) => {
                  const sarpras = item.sarpras
                  const lokasi = sarpras?.lokasi_id ? lokasiMap[sarpras.lokasi_id] : null
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {new Date(item.tanggal).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="font-medium">{sarpras?.nama || "-"}</div>
                        <div className="text-xs text-gray-500 font-mono">{sarpras?.kode || "-"}</div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold capitalize text-gray-700">
                          {item.kondisi}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{lokasi?.nama_lokasi || "-"}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.deskripsi || "-"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  )
}
