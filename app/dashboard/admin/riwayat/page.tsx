/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

interface RiwayatItem {
    id: string
    kondisi: string
    jumlah: number
    foto: string | null
    created_at?: string | null
    pengembalian: {
        id: string
        tanggal_kembali_real: string | null
        peminjaman: {
            kode_peminjaman: string | null
            profiles: { nama_lengkap: string | null } | null
        } | null
    } | null
    sarpras: {
        nama: string | null
        kode: string | null
    } | null
}

const FILTERS = ['SEMUA', 'BAIK', 'RUSAK RINGAN', 'RUSAK BERAT', 'HILANG'] as const

export default function RiwayatPengembalianPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [items, setItems] = useState<RiwayatItem[]>([])
    const [filter, setFilter] = useState<typeof FILTERS[number]>('SEMUA')
    const [search, setSearch] = useState('')
    const [detailOpen, setDetailOpen] = useState(false)
    const [detailItem, setDetailItem] = useState<RiwayatItem | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const profileId = localStorage.getItem('profileId')
                if (!profileId) {
                    router.push('/login')
                    return
                }

                const { data: profile, error: roleError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', profileId)
                    .single()

                if (roleError || !profile || profile.role !== 'admin') {
                    router.push('/dashboard')
                    return
                }

                const { data, error } = await supabase
                    .from('pengembalian_detail')
                    .select(`
                        id,
                        kondisi,
                        jumlah,
                        foto,
                        pengembalian:pengembalian_id (
                            id,
                            tanggal_kembali_real,
                            peminjaman:peminjaman_id (
                                kode_peminjaman,
                                profiles:user_id (nama_lengkap)
                            )
                        ),
                        sarpras:sarpras_id (nama, kode)
                    `)
                    .order('pengembalian_id', { ascending: false })

                if (error) throw error
                const normalized = (data as any[] | null)?.map((row) => {
                    const pengembalian = Array.isArray(row.pengembalian) ? row.pengembalian[0] : row.pengembalian
                    const peminjaman = Array.isArray(pengembalian?.peminjaman) ? pengembalian?.peminjaman[0] : pengembalian?.peminjaman
                    const profiles = Array.isArray(peminjaman?.profiles) ? peminjaman?.profiles[0] : peminjaman?.profiles
                    const sarpras = Array.isArray(row.sarpras) ? row.sarpras[0] : row.sarpras
                    return {
                        id: row.id,
                        kondisi: row.kondisi,
                        jumlah: row.jumlah,
                        foto: row.foto ?? null,
                        pengembalian: pengembalian
                            ? {
                                  id: pengembalian.id,
                                  tanggal_kembali_real: pengembalian.tanggal_kembali_real ?? null,
                                  peminjaman: peminjaman
                                      ? {
                                            kode_peminjaman: peminjaman.kode_peminjaman ?? null,
                                            profiles: profiles
                                                ? { nama_lengkap: profiles.nama_lengkap ?? null }
                                                : null,
                                        }
                                      : null,
                              }
                            : null,
                        sarpras: sarpras
                            ? { nama: sarpras.nama ?? null, kode: sarpras.kode ?? null }
                            : null,
                    } as RiwayatItem
                }) || []
                setItems(normalized)
            } catch (err) {
                console.error('Error fetching riwayat pengembalian:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [router])

    const filtered = useMemo(() => {
        const q = search.toLowerCase()
        return items.filter((item) => {
            const kondisi = item.kondisi || ''
            const matchesFilter =
                filter === 'SEMUA' ||
                (filter === 'BAIK' && kondisi === 'baik') ||
                (filter === 'HILANG' && kondisi === 'hilang') ||
                (filter === 'RUSAK RINGAN' && kondisi === 'rusak_ringan') ||
                (filter === 'RUSAK BERAT' && kondisi === 'rusak_berat')

            const kode = item.pengembalian?.peminjaman?.kode_peminjaman || ''
            const peminjam = item.pengembalian?.peminjaman?.profiles?.nama_lengkap || ''
            const sarpras = item.sarpras?.nama || ''
            const sarprasKode = item.sarpras?.kode || ''

            const matchesSearch =
                kode.toLowerCase().includes(q) ||
                peminjam.toLowerCase().includes(q) ||
                sarpras.toLowerCase().includes(q) ||
                sarprasKode.toLowerCase().includes(q)

            return matchesFilter && matchesSearch
        })
    }, [items, filter, search])

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading...</div>
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Riwayat Pengembalian</h1>
                <p className="text-gray-600 mt-2">Filter kondisi barang dari data pengembalian.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                        placeholder="Cari kode, peminjam, atau sarpras..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex bg-gray-100 p-1 rounded-full">
                    {FILTERS.map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                filter === f ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <Card className="overflow-hidden">
                <CardHeader>
                    <CardTitle>Daftar Pengembalian</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="text-left py-3 px-4">Tanggal</th>
                                    <th className="text-left py-3 px-4">Kode Peminjaman</th>
                                    <th className="text-left py-3 px-4">Peminjam</th>
                                    <th className="text-left py-3 px-4">Sarpras</th>
                                    <th className="text-left py-3 px-4">Kondisi</th>
                                    <th className="text-left py-3 px-4">Jumlah</th>
                                    <th className="text-left py-3 px-4">Foto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-8 text-gray-500">
                                            Tidak ada data.
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((item) => {
                                        const tanggal = item.pengembalian?.tanggal_kembali_real
                                        const kondisiLabel =
                                            item.kondisi === 'rusak_ringan'
                                                ? 'Rusak Ringan'
                                                : item.kondisi === 'rusak_berat'
                                                ? 'Rusak Berat'
                                                : item.kondisi === 'baik'
                                                ? 'Baik'
                                                : item.kondisi === 'hilang'
                                                ? 'Hilang'
                                                : item.kondisi
                                        return (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="py-3 px-4 text-gray-600">
                                                    {tanggal ? new Date(tanggal).toLocaleDateString('id-ID') : '-'}
                                                </td>
                                                <td className="py-3 px-4 font-mono">
                                                    {item.pengembalian?.peminjaman?.kode_peminjaman || '-'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {item.pengembalian?.peminjaman?.profiles?.nama_lengkap || '-'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-medium">{item.sarpras?.nama || '-'}</div>
                                                    <div className="text-xs text-gray-500 font-mono">{item.sarpras?.kode || '-'}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                                        item.kondisi === 'baik'
                                                            ? 'bg-green-100 text-green-700'
                                                            : item.kondisi === 'hilang'
                                                            ? 'bg-red-100 text-red-700'
                                                            : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                        {kondisiLabel}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">{item.jumlah}</td>
                                                <td className="py-3 px-4">
                                                    {item.foto ? (
                                                        <img src={item.foto} alt="Bukti" className="h-10 w-10 rounded object-cover border" />
                                                    ) : (
                                                        <span className="text-xs text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <button
                                                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                                                        onClick={() => {
                                                            setDetailItem(item)
                                                            setDetailOpen(true)
                                                        }}
                                                    >
                                                        Detail
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {detailOpen && detailItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
                        <div className="flex items-center justify-between">
                            <div className="text-lg font-bold">Detail Pengembalian</div>
                            <button className="text-gray-400 hover:text-gray-600" onClick={() => setDetailOpen(false)}>
                                ✕
                            </button>
                        </div>
                        <div className="mt-4 space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Tanggal</span>
                                <span className="font-medium">
                                    {detailItem.pengembalian?.tanggal_kembali_real
                                        ? new Date(detailItem.pengembalian.tanggal_kembali_real).toLocaleDateString('id-ID')
                                        : '-'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Kode Peminjaman</span>
                                <span className="font-mono font-semibold">{detailItem.pengembalian?.peminjaman?.kode_peminjaman || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Peminjam</span>
                                <span className="font-medium">{detailItem.pengembalian?.peminjaman?.profiles?.nama_lengkap || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Sarpras</span>
                                <span className="font-medium">{detailItem.sarpras?.nama || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Kode Sarpras</span>
                                <span className="font-mono">{detailItem.sarpras?.kode || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Kondisi</span>
                                <span className="font-semibold capitalize">{detailItem.kondisi}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Jumlah</span>
                                <span className="font-semibold">{detailItem.jumlah}</span>
                            </div>
                            <div>
                                <div className="text-gray-500 mb-2">Foto Bukti</div>
                                {detailItem.foto ? (
                                    <img src={detailItem.foto} alt="Bukti" className="h-40 w-full rounded-lg object-cover border" />
                                ) : (
                                    <div className="text-xs text-gray-400">Tidak ada foto.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}