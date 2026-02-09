'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Edit, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface Lokasi {
    id: string
    nama_lokasi: string
    gedung: string | null
    lantai: string | null
    keterangan: string | null
    created_at: string
    updated_at: string
}

export default function LokasiPage() {
    const router = useRouter()
    const [lokasis, setLokasis] = useState<Lokasi[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [userRole, setUserRole] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [filteredLokasis, setFilteredLokasis] = useState<Lokasi[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        nama_lokasi: '',
        gedung: '',
        lantai: '',
        keterangan: '',
    })
    const [editData, setEditData] = useState({
        id: '',
        nama_lokasi: '',
        gedung: '',
        lantai: '',
        keterangan: '',
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

                // Fetch all lokasi
                const { data: allLokasi, error: lokasiError } = await supabase
                    .from('lokasi')
                    .select('id, nama_lokasi, gedung, lantai, keterangan, created_at, updated_at')
                    .order('created_at', { ascending: false })

                if (!lokasiError && allLokasi) {
                    setLokasis(allLokasi)
                }
            } catch (err) {
                console.error('Error fetching data:', err)
                router.push('/login')
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [router])

    // Filter lokasi based on search term
    useEffect(() => {
        const filtered = lokasis.filter((lokasi) => {
            const searchLower = searchTerm.toLowerCase()
            return (
                lokasi.nama_lokasi.toLowerCase().includes(searchLower) ||
                lokasi.gedung?.toLowerCase().includes(searchLower) ||
                lokasi.lantai?.toLowerCase().includes(searchLower) ||
                lokasi.keterangan?.toLowerCase().includes(searchLower)
            )
        })
        setFilteredLokasis(filtered)
    }, [searchTerm, lokasis])

    const handleDeleteLokasi = async (lokasiId: string) => {
        if (!window.confirm('Apakah Anda yakin ingin menghapus lokasi ini?')) {
            return
        }

        try {
            const { error } = await supabase
                .from('lokasi')
                .delete()
                .eq('id', lokasiId)

            if (error) {
                console.error('Error deleting lokasi:', error)
                alert('Gagal menghapus lokasi')
            } else {
                setLokasis(lokasis.filter((l) => l.id !== lokasiId))
                alert('Lokasi berhasil dihapus')
            }
        } catch (err) {
            console.error('Error deleting lokasi:', err)
            alert('Terjadi kesalahan saat menghapus lokasi')
        }
    }

    const handleAddLokasi = async () => {
        if (!formData.nama_lokasi.trim()) {
            alert('Nama lokasi harus diisi')
            return
        }

        setIsSubmitting(true)
        try {
            const { data: lokasiData, error: lokasiError } = await supabase
                .from('lokasi')
                .insert([
                    {
                        nama_lokasi: formData.nama_lokasi,
                        gedung: formData.gedung || null,
                        lantai: formData.lantai || null,
                        keterangan: formData.keterangan || null,
                    },
                ])
                .select('id, nama_lokasi, gedung, lantai, keterangan, created_at, updated_at')
                .single()

            if (lokasiError) {
                console.error('Error creating lokasi:', lokasiError)
                alert(`Gagal membuat lokasi: ${lokasiError.message || JSON.stringify(lokasiError)}`)
                return
            }

            if (!lokasiData) {
                console.error('No lokasi data returned')
                alert('Gagal membuat lokasi: Tidak ada data yang dikembalikan')
                return
            }

            // Add new lokasi to the list
            setLokasis([lokasiData, ...lokasis])

            // Reset form
            setFormData({
                nama_lokasi: '',
                gedung: '',
                lantai: '',
                keterangan: '',
            })
            setIsModalOpen(false)
            alert('Lokasi berhasil ditambahkan')
        } catch (err) {
            console.error('Error adding lokasi:', err)
            alert(`Terjadi kesalahan saat menambahkan lokasi: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    const openEditModal = (lokasi: Lokasi) => {
        setEditData({
            id: lokasi.id,
            nama_lokasi: lokasi.nama_lokasi || '',
            gedung: lokasi.gedung || '',
            lantai: lokasi.lantai || '',
            keterangan: lokasi.keterangan || '',
        })
        setIsEditOpen(true)
    }

    const handleUpdateLokasi = async () => {
        if (!editData.id) return
        if (!editData.nama_lokasi.trim()) {
            alert('Nama lokasi harus diisi')
            return
        }

        setIsSubmitting(true)
        try {
            const { data, error } = await supabase
                .from('lokasi')
                .update({
                    nama_lokasi: editData.nama_lokasi.trim(),
                    gedung: editData.gedung.trim() || null,
                    lantai: editData.lantai.trim() || null,
                    keterangan: editData.keterangan.trim() || null,
                })
                .eq('id', editData.id)
                .select('id, nama_lokasi, gedung, lantai, keterangan, created_at, updated_at')
                .single()

            if (error) {
                console.error('Error updating lokasi:', error)
                alert(`Gagal memperbarui lokasi: ${error.message || JSON.stringify(error)}`)
                return
            }

            if (!data) {
                alert('Gagal memperbarui lokasi: data tidak ditemukan')
                return
            }

            setLokasis((prev) => prev.map((l) => (l.id === data.id ? data : l)))
            setIsEditOpen(false)
            alert('Lokasi berhasil diperbarui')
        } catch (err) {
            console.error('Error updating lokasi:', err)
            alert('Terjadi kesalahan saat memperbarui lokasi')
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
                    <h1 className="text-3xl font-bold text-gray-900">Lokasi Sarpras</h1>
                    <p className="text-gray-600 mt-2">Kelola semua lokasi sarana dan prasarana</p>
                </div>
                <Button className="bg-gray-900 hover:bg-gray-800" onClick={() => setIsModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Lokasi
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Daftar Lokasi</CardTitle>
                    <CardDescription>Kelola dan monitor semua lokasi sarpras terdaftar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <Input
                            placeholder="Cari berdasarkan nama atau deskripsi lokasi..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Nama Lokasi</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Gedung</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Lantai</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Keterangan</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Dibuat</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLokasis.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-gray-500">
                                            {searchTerm ? 'Tidak ada lokasi yang sesuai dengan pencarian' : 'Tidak ada lokasi ditemukan'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLokasis.map((lokasi) => (
                                        <tr key={lokasi.id} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="py-3 px-4 text-gray-900 font-medium">{lokasi.nama_lokasi}</td>
                                            <td className="py-3 px-4 text-gray-600">
                                                {lokasi.gedung || '-'}
                                            </td>
                                            <td className="py-3 px-4 text-gray-600">
                                                {lokasi.lantai || '-'}
                                            </td>
                                            <td className="py-3 px-4 text-gray-600 text-sm">
                                                {lokasi.keterangan || '-'}
                                            </td>
                                            <td className="py-3 px-4 text-gray-600 text-xs">
                                                {new Date(lokasi.created_at).toLocaleDateString('id-ID')}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                        onClick={() => openEditModal(lokasi)}
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => handleDeleteLokasi(lokasi.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary */}
                    <div className="pt-4 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                            Menampilkan <span className="font-semibold">{filteredLokasis.length}</span> dari{' '}
                            <span className="font-semibold">{lokasis.length}</span> lokasi
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Add Lokasi Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle>Tambah Lokasi Baru</CardTitle>
                            <CardDescription>Isi form di bawah untuk menambahkan lokasi baru</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lokasi</label>
                                <Input
                                    type="text"
                                    placeholder="Masukkan nama lokasi"
                                    value={formData.nama_lokasi}
                                    onChange={(e) => setFormData({ ...formData, nama_lokasi: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Gedung (Opsional)</label>
                                <Input
                                    type="text"
                                    placeholder="Masukkan nama gedung"
                                    value={formData.gedung}
                                    onChange={(e) => setFormData({ ...formData, gedung: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Lantai (Opsional)</label>
                                <Input
                                    type="text"
                                    placeholder="Masukkan lantai"
                                    value={formData.lantai}
                                    onChange={(e) => setFormData({ ...formData, lantai: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan (Opsional)</label>
                                <textarea
                                    placeholder="Masukkan keterangan lokasi"
                                    value={formData.keterangan}
                                    onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    rows={3}
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
                                    onClick={handleAddLokasi}
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
                    <Card className="w-full max-w-md">
                        <CardHeader className="flex flex-row items-start justify-between">
                            <div>
                                <CardTitle>Edit Lokasi</CardTitle>
                                <CardDescription>Perbarui data lokasi sarpras.</CardDescription>
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lokasi</label>
                                <Input
                                    type="text"
                                    placeholder="Masukkan nama lokasi"
                                    value={editData.nama_lokasi}
                                    onChange={(e) => setEditData({ ...editData, nama_lokasi: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Gedung (Opsional)</label>
                                <Input
                                    type="text"
                                    placeholder="Masukkan nama gedung"
                                    value={editData.gedung}
                                    onChange={(e) => setEditData({ ...editData, gedung: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Lantai (Opsional)</label>
                                <Input
                                    type="text"
                                    placeholder="Masukkan lantai"
                                    value={editData.lantai}
                                    onChange={(e) => setEditData({ ...editData, lantai: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan (Opsional)</label>
                                <textarea
                                    placeholder="Masukkan keterangan lokasi"
                                    value={editData.keterangan}
                                    onChange={(e) => setEditData({ ...editData, keterangan: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    rows={3}
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
                                    onClick={handleUpdateLokasi}
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
