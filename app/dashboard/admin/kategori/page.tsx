'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Edit, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface Kategori {
    id: string
    nama: string
    deskripsi: string | null
    icon: string | null
    is_active?: boolean
    created_at: string
    updated_at: string
}

export default function KategoriPage() {
    const router = useRouter()
    const [kategoris, setKategoris] = useState<Kategori[]>([])
    const [filteredKategoris, setFilteredKategoris] = useState<Kategori[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [userRole, setUserRole] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showInactive, setShowInactive] = useState(false)
    const [formData, setFormData] = useState({
        nama: '',
        deskripsi: '',
        icon: '',
    })
    const [editData, setEditData] = useState({
        id: '',
        nama: '',
        deskripsi: '',
        icon: '',
    })

    useEffect(() => {
        const fetchData = async () => {
            try {
                const profileId = localStorage.getItem('profileId')
                if (!profileId) {
                    router.push('/login')
                    return
                }

                // ambil role user
                const { data: profile, error: roleError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', profileId)
                    .single()

                if (roleError || !profile || profile.role !== 'admin') {
                    router.push('/dashboard')
                    return
                }

                setUserRole(profile.role)

                // ambil data kategori (SESUAI DB)
                const baseQuery = supabase
                    .from('kategori')
                    .select('id, nama, deskripsi, icon, is_active, created_at, updated_at')

                const { data, error } = showInactive
                    ? await baseQuery.order('created_at', { ascending: false })
                    : await baseQuery.eq('is_active', true).order('created_at', { ascending: false })

                if (!error && data) {
                    setKategoris(data)
                    setFilteredKategoris(data)
                }
            } catch (err) {
                console.error(err)
                router.push('/login')
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [router, showInactive])

    // search filter
    useEffect(() => {
        const keyword = searchTerm.toLowerCase()
        setFilteredKategoris(
            kategoris.filter(
                (k) =>
                    k.nama.toLowerCase().includes(keyword) ||
                    k.deskripsi?.toLowerCase().includes(keyword)
            )
        )
    }, [searchTerm, kategoris])

    const handleDeleteKategori = async (id: string) => {
        if (!confirm('Apakah Anda yakin ingin menghapus kategori ini?')) return

        const { data, error } = await supabase
            .from('kategori')
            .update({ is_active: false })
            .eq('id', id)
            .select('id, is_active')

        if (!error && data && data.length > 0) {
            if (!showInactive) {
                setKategoris((prev) => prev.filter((k) => k.id !== id))
                setFilteredKategoris((prev) => prev.filter((k) => k.id !== id))
            } else {
                setKategoris((prev) => prev.map((k) => (k.id === id ? { ...k, is_active: false } : k)))
                setFilteredKategoris((prev) => prev.map((k) => (k.id === id ? { ...k, is_active: false } : k)))
            }
            localStorage.setItem('kategoriUpdatedAt', Date.now().toString())
        } else {
            alert('Gagal menghapus kategori')
        }
    }

    const handleRestoreKategori = async (id: string) => {
        if (!confirm('Pulihkan kategori ini agar tampil kembali?')) return

        const { data, error } = await supabase
            .from('kategori')
            .update({ is_active: true })
            .eq('id', id)
            .select('id, is_active')

        if (!error && data && data.length > 0) {
            if (!showInactive) {
                setKategoris((prev) => prev.filter((k) => k.id !== id))
                setFilteredKategoris((prev) => prev.filter((k) => k.id !== id))
            } else {
                setKategoris((prev) => prev.map((k) => (k.id === id ? { ...k, is_active: true } : k)))
                setFilteredKategoris((prev) => prev.map((k) => (k.id === id ? { ...k, is_active: true } : k)))
            }
            localStorage.setItem('kategoriUpdatedAt', Date.now().toString())
        } else {
            alert('Gagal memulihkan kategori')
        }
    }

    const handleAddKategori = async () => {
        if (!formData.nama.trim()) {
            alert('Nama kategori wajib diisi')
            return
        }

        setIsSubmitting(true)
        try {
            const { data, error } = await supabase
                .from('kategori')
                .insert([
                    {
                        nama: formData.nama.trim(),
                        deskripsi: formData.deskripsi.trim() || null,
                        icon: formData.icon.trim() || null,
                    },
                ])
                .select('id, nama, deskripsi, icon, created_at, updated_at')
                .single()

            if (error) {
                console.error('Error adding kategori:', error)
                alert(`Gagal menambahkan kategori: ${error.message || JSON.stringify(error)}`)
                return
            }

            if (!data) {
                alert('Gagal menambahkan kategori: data tidak ditemukan')
                return
            }

            setKategoris((prev) => [data, ...prev])
            setFilteredKategoris((prev) => [data, ...prev])
            setFormData({ nama: '', deskripsi: '', icon: '' })
            setIsModalOpen(false)
            alert('Kategori berhasil ditambahkan')
        } catch (err) {
            console.error('Error adding kategori:', err)
            alert('Terjadi kesalahan saat menambahkan kategori')
        } finally {
            setIsSubmitting(false)
        }
    }

    const openEditModal = (kategori: Kategori) => {
        setEditData({
            id: kategori.id,
            nama: kategori.nama || '',
            deskripsi: kategori.deskripsi || '',
            icon: kategori.icon || '',
        })
        setIsEditOpen(true)
    }

    const handleUpdateKategori = async () => {
        if (!editData.id) return
        if (!editData.nama.trim()) {
            alert('Nama kategori wajib diisi')
            return
        }

        setIsSubmitting(true)
        try {
            const { data, error } = await supabase
                .from('kategori')
                .update({
                    nama: editData.nama.trim(),
                    deskripsi: editData.deskripsi.trim() || null,
                    icon: editData.icon.trim() || null,
                })
                .eq('id', editData.id)
                .select('id, nama, deskripsi, icon, created_at, updated_at')
                .single()

            if (error) {
                console.error('Error updating kategori:', error)
                alert(`Gagal memperbarui kategori: ${error.message || JSON.stringify(error)}`)
                return
            }

            if (!data) {
                alert('Gagal memperbarui kategori: data tidak ditemukan')
                return
            }

            setKategoris((prev) => prev.map((k) => (k.id === data.id ? data : k)))
            setFilteredKategoris((prev) => prev.map((k) => (k.id === data.id ? data : k)))
            setIsEditOpen(false)
            alert('Kategori berhasil diperbarui')
        } catch (err) {
            console.error('Error updating kategori:', err)
            alert('Terjadi kesalahan saat memperbarui kategori')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-96">
                Loading...
            </div>
        )
    }

    if (userRole !== 'admin') {
        return (
            <div className="flex items-center justify-center min-h-96 text-red-600">
                Access Denied
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Kategori Sarpras</h1>
                    <p className="text-gray-600 mt-2">
                        Kelola kategori sarana dan prasarana
                    </p>
                </div>
                <Button
                    className="bg-gray-900 hover:bg-gray-800"
                    onClick={() => setIsModalOpen(true)}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Kategori
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Daftar Kategori</CardTitle>
                    <CardDescription>Manajemen kategori sarpras</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Search */}
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="relative w-full md:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <Input
                                placeholder="Cari kategori..."
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
                                <tr className="border-b">
                                    <th className="text-left py-3 px-4">Nama</th>
                                    <th className="text-left py-3 px-4">Deskripsi</th>
                                    <th className="text-left py-3 px-4">Dibuat</th>
                                    <th className="text-left py-3 px-4">Status</th>
                                    <th className="text-left py-3 px-4">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredKategoris.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-10 text-gray-500">
                                            Data tidak ditemukan
                                        </td>
                                    </tr>
                                ) : (
                                    filteredKategoris.map((k) => (
                                        <tr key={k.id} className="border-b hover:bg-gray-50">
                                            <td className="py-3 px-4 font-medium">
                                                {k.nama}
                                            </td>
                                            <td className="py-3 px-4 text-gray-600">
                                                {k.deskripsi || '-'}
                                            </td>
                                            <td className="py-3 px-4 text-xs text-gray-500">
                                                {new Date(k.created_at).toLocaleDateString('id-ID')}
                                            </td>
                                            <td className="py-3 px-4">
                                                {k.is_active === false ? (
                                                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">Nonaktif</span>
                                                ) : (
                                                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Aktif</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openEditModal(k)}
                                                        disabled={k.is_active === false}
                                                    >
                                                        <Edit className="w-4 h-4 text-blue-600" />
                                                    </Button>
                                                    {k.is_active === false ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleRestoreKategori(k.id)}
                                                        >
                                                            Pulihkan
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteKategori(k.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4 text-red-600" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="pt-4 border-t text-sm text-gray-600">
                        Menampilkan <b>{filteredKategoris.length}</b> dari{' '}
                        <b>{kategoris.length}</b> kategori
                    </div>
                </CardContent>
            </Card>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <Card className="w-full max-w-md">
                        <CardHeader className="flex flex-row items-start justify-between">
                            <div>
                                <CardTitle>Tambah Kategori</CardTitle>
                                <CardDescription>Isi data kategori sarpras baru.</CardDescription>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-500 hover:text-gray-700"
                                onClick={() => setIsModalOpen(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Kategori</label>
                                <Input
                                    placeholder="Contoh: Elektronik"
                                    value={formData.nama}
                                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi (Opsional)</label>
                                <textarea
                                    placeholder="Tuliskan deskripsi singkat"
                                    value={formData.deskripsi}
                                    onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    rows={3}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Icon (Opsional)</label>
                                <Input
                                    placeholder="Contoh: fa-solid fa-box"
                                    value={formData.icon}
                                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
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
                                    onClick={handleAddKategori}
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <Card className="w-full max-w-md">
                        <CardHeader className="flex flex-row items-start justify-between">
                            <div>
                                <CardTitle>Edit Kategori</CardTitle>
                                <CardDescription>Perbarui data kategori sarpras.</CardDescription>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-500 hover:text-gray-700"
                                onClick={() => setIsEditOpen(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Kategori</label>
                                <Input
                                    placeholder="Contoh: Elektronik"
                                    value={editData.nama}
                                    onChange={(e) => setEditData({ ...editData, nama: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi (Opsional)</label>
                                <textarea
                                    placeholder="Tuliskan deskripsi singkat"
                                    value={editData.deskripsi}
                                    onChange={(e) => setEditData({ ...editData, deskripsi: e.target.value })}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    rows={3}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Icon (Opsional)</label>
                                <Input
                                    placeholder="Contoh: fa-solid fa-box"
                                    value={editData.icon}
                                    onChange={(e) => setEditData({ ...editData, icon: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
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
                                    onClick={handleUpdateKategori}
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
