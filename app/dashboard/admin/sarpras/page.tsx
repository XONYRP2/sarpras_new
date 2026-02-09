'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Edit, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

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

/** Generate kode unik: SINGKATAN_KATEGORI-SINGKATAN_NAMA-DDMMYY (contoh: EL-BUK-060226) */
function generateKodeUnik(kategoriNama: string, namaBarang: string, date: Date = new Date()): string {
    const singkatanKategori = kategoriNama
        .trim()
        .split(/\s+/)[0]
        .slice(0, 2)
        .toUpperCase()
    const singkatanNama = namaBarang
        .trim()
        .replace(/\s+/g, '')
        .slice(0, 3)
        .toUpperCase()
    const dd = String(date.getDate()).padStart(2, '0')
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const yy = String(date.getFullYear()).slice(-2)
    return `${singkatanKategori || 'XX'}-${singkatanNama || 'XXX'}-${dd}${mm}${yy}`
}

export default function SarprasPage() {
    const router = useRouter()
    const [sarprases, setSarprases] = useState<Sarpras[]>([])
    const [kategoris, setKategoris] = useState<Record<string, Kategori>>({})
    const [lokasis, setLokasis] = useState<Record<string, Lokasi>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [userRole, setUserRole] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [filteredSarprases, setFilteredSarprases] = useState<Sarpras[]>([])
    const [showInactive, setShowInactive] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        nama: '',
        kategori_id: '',
        lokasi_id: '',
        stok_total: '',
        stok_tersedia: '',
        kondisi: 'baik',
        merk: '',
    })
    const [editData, setEditData] = useState({
        id: '',
        kode: '',
        nama: '',
        kategori_id: '',
        lokasi_id: '',
        stok_total: '',
        stok_tersedia: '',
        kondisi: 'baik',
        merk: '',
    })

    useEffect(() => {
        const fetchData = async () => {
            try {
                const profileId = localStorage.getItem('profileId')

                if (!profileId) {
                    router.push('/login')
                    return
                }

                // Fetch user role from profiles table
                const { data: profile, error: roleError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', profileId)
                    .single()

                if (roleError || !profile) {
                    router.push('/login')
                    return
                }

                // Check if user is admin
                if (profile.role !== 'admin') {
                    router.push('/dashboard')
                    return
                }

                setUserRole(profile.role)

                // Fetch all sarpras
                const baseQuery = supabase
                    .from('sarpras')
                    .select('id, kode, nama, kategori_id, lokasi_id, stok_total, stok_tersedia, kondisi, merk, is_active, created_at, updated_at')

                const { data: allSarpras, error: sarprasError } = showInactive
                    ? await baseQuery.order('created_at', { ascending: false })
                    : await baseQuery.eq('is_active', true).order('created_at', { ascending: false })

                if (!sarprasError && allSarpras) {
                    setSarprases(allSarpras)

                    // Fetch all kategoris
                    const { data: allKategoris, error: kategorisError } = await supabase
                        .from('kategori')
                        .select('id, nama')

                    if (!kategorisError && allKategoris) {
                        const kategoriMap: Record<string, Kategori> = {}
                        allKategoris.forEach((k) => {
                            kategoriMap[k.id] = k
                        })
                        setKategoris(kategoriMap)
                    }

                    // Fetch all lokasis
                    const { data: allLokasis, error: lokasisError } = await supabase
                        .from('lokasi')
                        .select('id, nama_lokasi')

                    if (!lokasisError && allLokasis) {
                        const lokasiMap: Record<string, Lokasi> = {}
                        allLokasis.forEach((l) => {
                            lokasiMap[l.id] = l
                        })
                        setLokasis(lokasiMap)
                    }
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

    // Filter sarpras based on search term
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

    const handleDeleteSarpras = async (sarprasId: string) => {
        if (!window.confirm('Apakah Anda yakin ingin menghapus sarpras ini?')) {
            return
        }

        try {
            const { data, error } = await supabase
                .from('sarpras')
                .update({ is_active: false })
                .eq('id', sarprasId)
                .select('id')

            if (error) {
                console.error('Error deleting sarpras:', error)
                alert('Gagal menghapus sarpras')
                return
            }

            if (!data || data.length === 0) {
                alert('Gagal menghapus sarpras: tidak ada baris terupdate (cek policy RLS)')
                return
            }

            setSarprases(sarprases.filter((s) => s.id !== sarprasId))
            alert('Sarpras berhasil dihapus dari tampilan')
        } catch (err) {
            console.error('Error deleting sarpras:', err)
            alert('Terjadi kesalahan saat menghapus sarpras')
        }
    }

    const handleRestoreSarpras = async (sarprasId: string) => {
        if (!window.confirm('Pulihkan sarpras ini agar tampil kembali?')) {
            return
        }

        try {
            const { data, error } = await supabase
                .from('sarpras')
                .update({ is_active: true })
                .eq('id', sarprasId)
                .select('id')

            if (error) {
                console.error('Error restoring sarpras:', error)
                alert('Gagal memulihkan sarpras')
                return
            }

            if (!data || data.length === 0) {
                alert('Gagal memulihkan sarpras: tidak ada baris terupdate (cek policy RLS)')
                return
            }

            if (!showInactive) {
                setSarprases((prev) => prev.filter((s) => s.id !== sarprasId))
            } else {
                setSarprases((prev) => prev.map((s) => (s.id === sarprasId ? { ...s, is_active: true } : s)))
            }
            alert('Sarpras berhasil dipulihkan')
        } catch (err) {
            console.error('Error restoring sarpras:', err)
            alert('Terjadi kesalahan saat memulihkan sarpras')
        }
    }

    const handleAddSarpras = async () => {
        if (!formData.nama.trim()) {
            alert('Nama sarpras harus diisi')
            return
        }
        const selectedKategori = formData.kategori_id ? kategoris[formData.kategori_id] : null
        const kategoriNama = selectedKategori?.nama ?? ''
        const kodeUnik = generateKodeUnik(kategoriNama, formData.nama)

        setIsSubmitting(true)
        try {
            const { data: sarprasData, error: sarprasError } = await supabase
                .from('sarpras')
                .insert([
                    {
                        kode: kodeUnik,
                        nama: formData.nama,
                        kategori_id: formData.kategori_id || null,
                        lokasi_id: formData.lokasi_id || null,
                        stok_total: parseInt(formData.stok_total) || 0,
                        stok_tersedia: parseInt(formData.stok_tersedia) || 0,
                        kondisi: formData.kondisi,
                        merk: formData.merk || null,
                        is_active: true,
                    },
                ])
                .select('id, kode, nama, kategori_id, lokasi_id, stok_total, stok_tersedia, kondisi, merk, is_active, created_at, updated_at')
                .single()

            if (sarprasError) {
                console.error('Error creating sarpras:', sarprasError)
                alert(`Gagal membuat sarpras: ${sarprasError.message || JSON.stringify(sarprasError)}`)
                return
            }

            if (!sarprasData) {
                console.error('No sarpras data returned')
                alert('Gagal membuat sarpras: Tidak ada data yang dikembalikan')
                return
            }

            // Add new sarpras to the list
            setSarprases([sarprasData, ...sarprases])

            // Reset form
            setFormData({
                nama: '',
                kategori_id: '',
                lokasi_id: '',
                stok_total: '',
                stok_tersedia: '',
                kondisi: 'baik',
                merk: '',
            })
            setIsModalOpen(false)
            alert('Sarpras berhasil ditambahkan')
        } catch (err) {
            console.error('Error adding sarpras:', err)
            alert(`Terjadi kesalahan saat menambahkan sarpras: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    const openEditModal = (sarpras: Sarpras) => {
        setEditData({
            id: sarpras.id,
            kode: sarpras.kode,
            nama: sarpras.nama || '',
            kategori_id: sarpras.kategori_id || '',
            lokasi_id: sarpras.lokasi_id || '',
            stok_total: String(sarpras.stok_total ?? ''),
            stok_tersedia: String(sarpras.stok_tersedia ?? ''),
            kondisi: sarpras.kondisi || 'baik',
            merk: sarpras.merk || '',
        })
        setIsEditOpen(true)
    }

    const handleUpdateSarpras = async () => {
        if (!editData.id) return
        if (!editData.nama.trim()) {
            alert('Nama sarpras harus diisi')
            return
        }

        setIsSubmitting(true)
        try {
            const { data, error } = await supabase
                .from('sarpras')
                .update({
                    nama: editData.nama.trim(),
                    kategori_id: editData.kategori_id || null,
                    lokasi_id: editData.lokasi_id || null,
                    stok_total: parseInt(editData.stok_total) || 0,
                    stok_tersedia: parseInt(editData.stok_tersedia) || 0,
                    kondisi: editData.kondisi,
                    merk: editData.merk.trim() || null,
                })
                .eq('id', editData.id)
                .select('id, kode, nama, kategori_id, lokasi_id, stok_total, stok_tersedia, kondisi, merk, created_at, updated_at')
                .single()

            if (error) {
                console.error('Error updating sarpras:', error)
                alert(`Gagal memperbarui sarpras: ${error.message || JSON.stringify(error)}`)
                return
            }

            if (!data) {
                alert('Gagal memperbarui sarpras: data tidak ditemukan')
                return
            }

            setSarprases((prev) => prev.map((s) => (s.id === data.id ? data : s)))
            setIsEditOpen(false)
            alert('Sarpras berhasil diperbarui')
        } catch (err) {
            console.error('Error updating sarpras:', err)
            alert('Terjadi kesalahan saat memperbarui sarpras')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-gray-600">Loading...</div>
            </div>
        )
    }

    if (userRole !== 'admin') {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-red-600">Access Denied</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Data Sarpras</h1>
                    <p className="text-gray-600 mt-2">Kelola semua sarana dan prasarana</p>
                </div>
                <Button className="bg-gray-900 hover:bg-gray-800" onClick={() => setIsModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Sarpras
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Daftar Sarpras</CardTitle>
                    <CardDescription>Kelola dan monitor semua sarana dan prasarana terdaftar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Search Bar */}
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

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Kode</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Nama</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Kategori</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Lokasi</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Stok</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Kondisi</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Merk</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSarprases.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-8 text-gray-500">
                                            {searchTerm ? 'Tidak ada sarpras yang sesuai dengan pencarian' : 'Tidak ada sarpras ditemukan'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSarprases.map((sarpras) => {
                                        const kategori = kategoris[sarpras.kategori_id || '']
                                        const lokasi = lokasis[sarpras.lokasi_id || '']
                                        return (
                                            <tr key={sarpras.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4 text-gray-900 font-medium">{sarpras.kode}</td>
                                                <td className="py-3 px-4 text-gray-900 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <span>{sarpras.nama}</span>
                                                        {sarpras.is_active === false && (
                                                            <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                                                                Nonaktif
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-gray-600">{kategori?.nama || '-'}</td>
                                                <td className="py-3 px-4 text-gray-600">{lokasi?.nama_lokasi || '-'}</td>
                                                <td className="py-3 px-4 text-gray-600">
                                                    <span className="text-sm">
                                                        {sarpras.stok_tersedia}/{sarpras.stok_total}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span
                                                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${sarpras.kondisi === 'baik'
                                                                ? 'bg-green-100 text-green-800'
                                                                : sarpras.kondisi === 'rusak_ringan'
                                                                    ? 'bg-yellow-100 text-yellow-800'
                                                                    : 'bg-red-100 text-red-800'
                                                            }`}
                                                    >
                                                        {sarpras.kondisi === 'baik'
                                                            ? 'Baik'
                                                            : sarpras.kondisi === 'rusak_ringan'
                                                                ? 'Rusak Ringan'
                                                                : 'Rusak Berat'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-gray-600">{sarpras.merk || '-'}</td>
                                                <td className="py-3 px-4">
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                            onClick={() => openEditModal(sarpras)}
                                                            disabled={sarpras.is_active === false}
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                        {sarpras.is_active === false ? (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                                onClick={() => handleRestoreSarpras(sarpras.id)}
                                                            >
                                                                Pulihkan
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => handleDeleteSarpras(sarpras.id)}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary */}
                    <div className="pt-4 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                            Menampilkan <span className="font-semibold">{filteredSarprases.length}</span> dari{' '}
                            <span className="font-semibold">{sarprases.length}</span> sarpras
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Add Sarpras Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <CardHeader>
                            <CardTitle>Tambah Sarpras Baru</CardTitle>
                            <CardDescription>Isi form di bawah untuk menambahkan sarpras baru</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kode (otomatis)</label>
                                <div className="px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700 font-mono text-sm">
                                    {formData.nama.trim() || formData.kategori_id
                                        ? generateKodeUnik(
                                            formData.kategori_id ? kategoris[formData.kategori_id]?.nama ?? '' : '',
                                            formData.nama,
                                            new Date()
                                        )
                                        : '—'}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Format: singkatan kategori + nama barang + tanggal (contoh: EL-BUK-060226)
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
                                <Input
                                    type="text"
                                    placeholder="Masukkan nama sarpras"
                                    value={formData.nama}
                                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                                <select
                                    value={formData.kategori_id}
                                    onChange={(e) => setFormData({ ...formData, kategori_id: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                                >
                                    <option value="">Pilih Kategori</option>
                                    {Object.entries(kategoris).map(([id, kategori]) => (
                                        <option key={id} value={id}>
                                            {kategori.nama}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
                                <select
                                    value={formData.lokasi_id}
                                    onChange={(e) => setFormData({ ...formData, lokasi_id: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                                >
                                    <option value="">Pilih Lokasi</option>
                                    {Object.entries(lokasis).map(([id, lokasi]) => (
                                        <option key={id} value={id}>
                                            {lokasi.nama_lokasi}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Stok Total</label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={formData.stok_total}
                                        onChange={(e) => setFormData({ ...formData, stok_total: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Stok Tersedia</label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={formData.stok_tersedia}
                                        onChange={(e) => setFormData({ ...formData, stok_tersedia: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kondisi</label>
                                <select
                                    value={formData.kondisi}
                                    onChange={(e) => setFormData({ ...formData, kondisi: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                                >
                                    <option value="baik">Baik</option>
                                    <option value="rusak_ringan">Rusak Ringan</option>
                                    <option value="rusak_berat">Rusak Berat</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Merk (Opsional)</label>
                                <Input
                                    type="text"
                                    placeholder="Masukkan merk sarpras"
                                    value={formData.merk}
                                    onChange={(e) => setFormData({ ...formData, merk: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-2 pt-4">
                                <Button
                                    variant="ghost"
                                    className="flex-1"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={isSubmitting}
                                >
                                    Batal
                                </Button>
                                <Button
                                    className="flex-1 bg-gray-900 hover:bg-gray-800"
                                    onClick={handleAddSarpras}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {isEditOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <CardHeader className="flex flex-row items-start justify-between">
                            <div>
                                <CardTitle>Edit Sarpras</CardTitle>
                                <CardDescription>Perbarui data sarana dan prasarana</CardDescription>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-500 hover:text-gray-700"
                                onClick={() => setIsEditOpen(false)}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kode</label>
                                <div className="px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700 font-mono text-sm">
                                    {editData.kode || '-'}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
                                <Input
                                    type="text"
                                    placeholder="Masukkan nama sarpras"
                                    value={editData.nama}
                                    onChange={(e) => setEditData({ ...editData, nama: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                                <select
                                    value={editData.kategori_id}
                                    onChange={(e) => setEditData({ ...editData, kategori_id: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                                >
                                    <option value="">Pilih Kategori</option>
                                    {Object.entries(kategoris).map(([id, kategori]) => (
                                        <option key={id} value={id}>
                                            {kategori.nama}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
                                <select
                                    value={editData.lokasi_id}
                                    onChange={(e) => setEditData({ ...editData, lokasi_id: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                                >
                                    <option value="">Pilih Lokasi</option>
                                    {Object.entries(lokasis).map(([id, lokasi]) => (
                                        <option key={id} value={id}>
                                            {lokasi.nama_lokasi}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Stok Total</label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={editData.stok_total}
                                        onChange={(e) => setEditData({ ...editData, stok_total: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Stok Tersedia</label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={editData.stok_tersedia}
                                        onChange={(e) => setEditData({ ...editData, stok_tersedia: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kondisi</label>
                                <select
                                    value={editData.kondisi}
                                    onChange={(e) => setEditData({ ...editData, kondisi: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                                >
                                    <option value="baik">Baik</option>
                                    <option value="rusak_ringan">Rusak Ringan</option>
                                    <option value="rusak_berat">Rusak Berat</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Merk (Opsional)</label>
                                <Input
                                    type="text"
                                    placeholder="Masukkan merk sarpras"
                                    value={editData.merk}
                                    onChange={(e) => setEditData({ ...editData, merk: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-2 pt-4">
                                <Button
                                    variant="ghost"
                                    className="flex-1"
                                    onClick={() => setIsEditOpen(false)}
                                    disabled={isSubmitting}
                                >
                                    Batal
                                </Button>
                                <Button
                                    className="flex-1 bg-gray-900 hover:bg-gray-800"
                                    onClick={handleUpdateSarpras}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
