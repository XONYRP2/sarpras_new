'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, CalendarDays, ClipboardList, FileText, Package, Users, AlertCircle, Sparkles } from "lucide-react"

interface PeminjamanItem {
  id: string
  user_id: string
  tujuan: string | null
  status: string
  created_at: string
  kode_peminjaman: string | null
}

interface Profile {
  id: string
  nama_lengkap: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState({
    users: 0,
    sarpras: 0,
    peminjaman: 0,
    peminjamanBaru: 0,
    pengaduanAktif: 0,
    assetAvailablePct: 0,
  })
  const [recentPeminjaman, setRecentPeminjaman] = useState<PeminjamanItem[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      try {
        // Check auth
        const profileId = localStorage.getItem('profileId')
        if (!profileId) {
          router.push('/login')
          return
        }

        // Verify admin role
        const { data: profile, error: roleError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', profileId)
          .single()

        if (roleError || !profile || profile.role !== 'admin') {
          router.push('/dashboard')
          return
        }

        // Fetch stats concurrently
        const [
          { count: userCount },
          { count: sarprasCount },
          { count: peminjamanCount },
          { count: peminjamanBaruCount },
          { count: pengaduanAktifCount },
          { data: stokAgg },
          { data: peminjamanLatest, error: peminjamanLatestError }
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('sarpras').select('*', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('peminjaman').select('*', { count: 'exact', head: true }).eq('status', 'dipinjam'),
          supabase.from('peminjaman').select('*', { count: 'exact', head: true }).eq('status', 'menunggu'),
          supabase.from('pengaduan').select('*', { count: 'exact', head: true }).in('status', ['menunggu', 'diproses']),
          supabase.from('sarpras').select('stok_total, stok_tersedia').eq('is_active', true),
          supabase
            .from('peminjaman')
            .select('id, user_id, tujuan, status, created_at, kode_peminjaman')
            .order('created_at', { ascending: false })
            .limit(6)
        ])

        if (peminjamanLatestError) {
          console.error('Error fetching latest peminjaman:', peminjamanLatestError)
        }

        const totalStok = (stokAgg || []).reduce((acc, item) => acc + (item.stok_total ?? 0), 0)
        const tersediaStok = (stokAgg || []).reduce((acc, item) => acc + (item.stok_tersedia ?? 0), 0)
        const assetAvailablePct = totalStok > 0 ? Math.round((tersediaStok / totalStok) * 100) : 0

        setRecentPeminjaman(peminjamanLatest || [])

        const userIds = [...new Set((peminjamanLatest || []).map((p) => p.user_id).filter(Boolean))]
        if (userIds.length > 0) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, nama_lengkap')
            .in('id', userIds)

          const profileMap: Record<string, Profile> = {}
          ;(profileData || []).forEach((p) => {
            profileMap[p.id] = p
          })
          setProfiles(profileMap)
        }

        setStats({
          users: userCount || 0,
          sarpras: sarprasCount || 0,
          peminjaman: peminjamanCount || 0,
          peminjamanBaru: peminjamanBaruCount || 0,
          pengaduanAktif: pengaduanAktifCount || 0,
          assetAvailablePct,
        })

      } catch (error) {
        console.error('Error fetching admin stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuthAndFetch()
  }, [router])

  const todayLabel = useMemo(() => {
    const today = new Date()
    return today.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'menunggu':
        return 'bg-amber-100 text-amber-800'
      case 'disetujui':
        return 'bg-sky-100 text-sky-800'
      case 'dipinjam':
        return 'bg-violet-100 text-violet-800'
      case 'dikembalikan':
        return 'bg-emerald-100 text-emerald-800'
      case 'ditolak':
        return 'bg-rose-100 text-rose-800'
      default:
        return 'bg-slate-100 text-slate-700'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'menunggu':
        return 'Menunggu'
      case 'disetujui':
        return 'Disetujui'
      case 'dipinjam':
        return 'Dipinjam'
      case 'dikembalikan':
        return 'Dikembalikan'
      case 'ditolak':
        return 'Ditolak'
      default:
        return status
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading dashboard stats...</div>
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <div className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.98),_rgba(6,12,24,0.98))] p-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(148,163,184,0.3)_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-cyan-400/40 to-indigo-500/30 blur-2xl" />
        <div className="absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-gradient-to-br from-emerald-400/35 to-teal-500/30 blur-2xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
              <Sparkles className="h-3.5 w-3.5" />
              Admin Control Room
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Halo, Administrator!
            </h1>
            <p className="text-sm text-white/70 md:text-base">
              Selamat datang di panel kontrol SARPRAS. Berikut ringkasan aktivitas sistem hari ini.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
            <CalendarDays className="h-5 w-5 text-white/80" />
            <div className="text-sm">
              <div className="text-[10px] uppercase text-white/60">Hari ini</div>
              <div className="font-semibold">{todayLabel}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,0.95),rgba(241,245,249,0.65))] shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aset Tersedia</div>
              <div className="rounded-2xl bg-slate-900/5 p-2 text-slate-700">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 text-3xl font-semibold text-slate-900">{stats.assetAvailablePct}%</div>
            <p className="text-xs text-slate-500 mt-2">Persentase stok tersedia</p>
          </CardContent>
        </Card>
        <Card className="border-amber-100 bg-[linear-gradient(135deg,rgba(255,251,235,0.95),rgba(254,243,199,0.55))] shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Peminjaman Baru</div>
              <div className="rounded-2xl bg-amber-100 p-2 text-amber-700">
                <ClipboardList className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 text-3xl font-semibold text-slate-900">{stats.peminjamanBaru}</div>
            <p className="text-xs text-amber-700/70 mt-2">Menunggu persetujuan</p>
          </CardContent>
        </Card>
        <Card className="border-rose-100 bg-[linear-gradient(135deg,rgba(255,241,242,0.95),rgba(254,205,211,0.55))] shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">Pengaduan Aktif</div>
              <div className="rounded-2xl bg-rose-100 p-2 text-rose-700">
                <AlertCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 text-3xl font-semibold text-slate-900">{stats.pengaduanAktif}</div>
            <p className="text-xs text-rose-700/70 mt-2">Laporan kerusakan</p>
          </CardContent>
        </Card>
        <Card className="border-sky-100 bg-[linear-gradient(135deg,rgba(239,246,255,0.95),rgba(219,234,254,0.55))] shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">Total Pengguna</div>
              <div className="rounded-2xl bg-sky-100 p-2 text-sky-700">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4 text-3xl font-semibold text-slate-900">{stats.users}</div>
            <p className="text-xs text-sky-700/70 mt-2">Anggota terdaftar</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="border-slate-200 bg-white/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Aktivitas Peminjaman</CardTitle>
              <p className="text-xs text-slate-500 mt-1">Daftar transaksi peminjaman terbaru.</p>
            </div>
            <button
              className="text-sm font-semibold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1"
              onClick={() => router.push('/dashboard/admin/peminjaman')}
            >
              Semua
              <ArrowRight className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentPeminjaman.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Belum ada transaksi peminjaman.
              </div>
            ) : (
              recentPeminjaman.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white/95 p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-semibold">
                      {(item.tujuan || item.kode_peminjaman || 'P').slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {item.tujuan || item.kode_peminjaman || 'Peminjaman'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {profiles[item.user_id]?.nama_lengkap || 'Pengguna'} • {new Date(item.created_at).toLocaleDateString('id-ID')}
                      </div>
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadge(item.status)}`}>
                    {getStatusLabel(item.status)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border border-slate-200 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Akses Cepat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                className="w-full rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:border-slate-200 hover:bg-slate-50"
                onClick={() => router.push('/dashboard/admin/sarpras')}
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Data Sarpras</div>
                    <div className="text-xs text-slate-500">Kelola inventaris sekolah</div>
                  </div>
                </div>
              </button>
              <button
                className="w-full rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50"
                onClick={() => router.push('/dashboard/admin/pengembalian')}
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Scan Pengembalian</div>
                    <div className="text-xs text-slate-500">Proses barang kembali</div>
                  </div>
                </div>
              </button>
              <button
                className="w-full rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:border-orange-200 hover:bg-orange-50"
                onClick={() => router.push('/dashboard/admin/laporan')}
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-orange-100 p-2 text-orange-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Lihat Laporan</div>
                    <div className="text-xs text-slate-500">Analitik & kondisi aset</div>
                  </div>
                </div>
              </button>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-sm">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertCircle className="h-4 w-4" />
                Butuh Bantuan?
              </div>
              <p className="text-xs text-white/70">
                Jika mengalami kendala sistem, hubungi administrator sekolah segera.
              </p>
              <button className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900">
                Hubungi Admin
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
