'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

interface Sarpras {
    id: string
    kode: string
    nama: string
    kategori_id: string | null
    lokasi_id: string | null
    stok_total: number
    stok_tersedia: number
    kondisi: string
    merk: string | null
    is_active?: boolean
    foto?: string | null
    created_at: string
    updated_at: string
}

interface Kategori {
    id: string
    nama: string
}

interface Lokasi {
    id: string
    nama_lokasi: string
}

export default function PetugasSarprasPage() {
    const router = useRouter()
    const [sarprases, setSarprases] = useState<Sarpras[]>([])
    const [kategoris, setKategoris] = useState<Record<string, Kategori>>({})
    const [lokasis, setLokasis] = useState<Record<string, Lokasi>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [userRole, setUserRole] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [filteredSarprases, setFilteredSarprases] = useState<Sarpras[]>([])
    const [showInactive, setShowInactive] = useState(false)

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

                if (roleError || !profile || profile.role !== 'petugas') {
                    router.push('/dashboard')
                    return
                }

                setUserRole(profile.role)

                const baseQuery = supabase
                    .from('sarpras')
                    .select('id, kode, nama, kategori_id, lokasi_id, stok_total, stok_tersedia, kondisi, merk, is_active, foto, created_at, updated_at')

                const { data: allSarpras } = showInactive
                    ? await baseQuery.order('created_at', { ascending: false })
                    : await baseQuery.eq('is_active', true).order('created_at', { ascending: false })

                if (allSarpras) {
                    setSarprases(allSarpras)
                }

                const { data: allKategoris } = await supabase
                    .from('kategori')
                    .select('id, nama')

                if (allKategoris) {
                    const kategoriMap: Record<string, Kategori> = {}
                    allKategoris.forEach((k) => {
                        kategoriMap[k.id] = k
                    })
                    setKategoris(kategoriMap)
                }

                const { data: allLokasis } = await supabase
                    .from('lokasi')
                    .select('id, nama_lokasi')

                if (allLokasis) {
                    const lokasiMap: Record<string, Lokasi> = {}
                    allLokasis.forEach((l) => {
                        lokasiMap[l.id] = l
                    })
                    setLokasis(lokasiMap)
                }
            } catch (err) {
                console.error('Error fetching data:', err)
                router.push('/login')
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [router, showInactive])

    useEffect(() => {
        const filtered = sarprases.filter((sarpras) => {
            const kategori = kategoris[sarpras.kategori_id || '']
            const lokasi = lokasis[sarpras.lokasi_id || '']
            const searchLower = searchTerm.toLowerCase()
            return (
                sarpras.kode.toLowerCase().includes(searchLower) ||
                sarpras.nama.toLowerCase().includes(searchLower) ||
                kategori?.nama.toLowerCase().includes(searchLower) ||
                lokasi?.nama_lokasi.toLowerCase().includes(searchLower) ||
                sarpras.merk?.toLowerCase().includes(searchLower)
            )
        })
        setFilteredSarprases(filtered)
    }, [searchTerm, sarprases, kategoris, lokasis])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-gray-600">Loading...</div>
            </div>
        )
    }

    if (userRole !== 'petugas') {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-red-600">Access Denied</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Data Sarpras</h1>
                <p className="text-gray-600 mt-2">Daftar sarana dan prasarana sekolah</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Daftar Sarpras</CardTitle>
                    <CardDescription>Data sarpras yang tersedia di sekolah</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="relative w-full md:max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <Input
                                placeholder="Cari berdasarkan kode, nama, kategori, lokasi, atau merk..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input
                                type="checkbox"
                                checked={showInactive}
                                onChange={(e) => setShowInactive(e.target.checked)}
                            />
                            Tampilkan yang nonaktif
                        </label>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Foto</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Kode</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Nama</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Kategori</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Lokasi</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Stok</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Kondisi</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Merk</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSarprases.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="text-center py-8 text-gray-500">
                                            {searchTerm ? 'Tidak ada sarpras yang sesuai dengan pencarian' : 'Tidak ada sarpras ditemukan'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSarprases.map((sarpras) => {
                                        const kategori = kategoris[sarpras.kategori_id || '']
                                        const lokasi = lokasis[sarpras.lokasi_id || '']
                                        return (
                                            <tr key={sarpras.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4">
                                                    <div className="h-10 w-10 rounded-md border bg-gray-50 overflow-hidden flex items-center justify-center">
                                                        {sarpras.foto ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={sarpras.foto} alt={sarpras.nama} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <span className="text-[10px] text-gray-400">No Photo</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 font-mono text-xs text-gray-700">{sarpras.kode}</td>
                                                <td className="py-3 px-4 font-semibold text-gray-900">{sarpras.nama}</td>
                                                <td className="py-3 px-4 text-gray-600">{kategori?.nama || '-'}</td>
                                                <td className="py-3 px-4 text-gray-600">{lokasi?.nama_lokasi || '-'}</td>
                                                <td className="py-3 px-4 text-gray-600">
                                                    <div className="text-xs">Total: {sarpras.stok_total}</div>
                                                    <div className="text-xs">Tersedia: {sarpras.stok_tersedia}</div>
                                                </td>
                                                <td className="py-3 px-4 text-gray-600">{sarpras.kondisi || '-'}</td>
                                                <td className="py-3 px-4 text-gray-600">{sarpras.merk || '-'}</td>
                                                <td className="py-3 px-4">
                                                    {sarpras.is_active === false ? (
                                                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">Nonaktif</span>
                                                    ) : (
                                                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Aktif</span>
                                                    )}
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
        </div>
    )
}
