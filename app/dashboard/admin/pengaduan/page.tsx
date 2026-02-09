'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Edit, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface Pengaduan {
    id: string
    user_id: string
    judul: string
    deskripsi: string
    lokasi: string | null
    sarpras_id: string | null
    foto: string | null
    kategori_kerusakan: string | null
    prioritas: string
    status: string
    created_at: string
    updated_at: string
}

interface Profile {
    id: string
    nama_lengkap: string
}

interface Sarpras {
    id: string
    nama: string
    kode: string
}

export default function PengaduanPage() {
    const router = useRouter()
    const [pengaduans, setPengaduans] = useState<Pengaduan[]>([])
    const [profiles, setProfiles] = useState<Record<string, Profile>>({})
    const [sarprases, setSarprases] = useState<Record<string, Sarpras>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [userRole, setUserRole] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [filteredPengaduans, setFilteredPengaduans] = useState<Pengaduan[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        user_id: '',
        judul: '',
        deskripsi: '',
        lokasi: '',
        sarpras_id: '',
        kategori_kerusakan: 'kerusakan',
        prioritas: 'normal',
        status: 'menunggu',
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

                // Fetch all pengaduans
                const { data: allPengaduans, error: pengaduanError } = await supabase
                    .from('pengaduan')
                    .select('*')
                    .order('created_at', { ascending: false })

                if (!pengaduanError && allPengaduans) {
                    setPengaduans(allPengaduans)

                    // Fetch all profiles
                    const { data: allProfiles, error: profilesError } = await supabase
                        .from('profiles')
                        .select('id, nama_lengkap')
                        .in('id', allPengaduans.map(p => p.user_id))

                    if (!profilesError && allProfiles) {
                        const profileMap: Record<string, Profile> = {}
                        allProfiles.forEach((p) => {
                            profileMap[p.id] = p
                        })
                        setProfiles(profileMap)
                    }

                    // Fetch all sarprases
                    const { data: allSarprases, error: sarprasesError } = await supabase
                        .from('sarpras')
                        .select('id, nama, kode')
                        .eq('is_active', true)

                    if (!sarprasesError && allSarprases) {
                        const sarprasMap: Record<string, Sarpras> = {}
                        allSarprases.forEach((s) => {
                            sarprasMap[s.id] = s
                        })
                        setSarprases(sarprasMap)
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
    }, [router])

    // Filter pengaduans based on search term
    useEffect(() => {
        const filtered = pengaduans.filter((pengaduan) => {
            const profileData = profiles[pengaduan.user_id]
            const sarprasData = sarprases[pengaduan.sarpras_id || '']
            const searchLower = searchTerm.toLowerCase()
            return (
                pengaduan.judul.toLowerCase().includes(searchLower) ||
                pengaduan.deskripsi.toLowerCase().includes(searchLower) ||
                pengaduan.lokasi?.toLowerCase().includes(searchLower) ||
                profileData?.nama_lengkap.toLowerCase().includes(searchLower) ||
                sarprasData?.nama.toLowerCase().includes(searchLower) ||
                pengaduan.status.toLowerCase().includes(searchLower)
            )
        })
        setFilteredPengaduans(filtered)
    }, [searchTerm, pengaduans, profiles, sarprases])

    const handleDeletePengaduan = async (pengaduanId: string) => {
        if (!window.confirm('Apakah Anda yakin ingin menghapus pengaduan ini?')) {
            return
        }

        try {
            const { error } = await supabase
                .from('pengaduan')
                .delete()
                .eq('id', pengaduanId)

            if (error) {
                console.error('Error deleting pengaduan:', error)
                alert('Gagal menghapus pengaduan')
            } else {
                setPengaduans(pengaduans.filter((p) => p.id !== pengaduanId))
                alert('Pengaduan berhasil dihapus')
            }
        } catch (err) {
            console.error('Error deleting pengaduan:', err)
            alert('Terjadi kesalahan saat menghapus pengaduan')
        }
    }

    const handleAddPengaduan = async () => {
        if (!formData.user_id || !formData.judul.trim() || !formData.deskripsi.trim()) {
            alert('Pelapor, judul, dan deskripsi harus diisi')
            return
        }

        setIsSubmitting(true)
        try {
            const { data: pengaduanData, error: pengaduanError } = await supabase
                .from('pengaduan')
                .insert([
                    {
                        user_id: formData.user_id,
                        judul: formData.judul,
                        deskripsi: formData.deskripsi,
                        lokasi: formData.lokasi || null,
                        sarpras_id: formData.sarpras_id || null,
                        kategori_kerusakan: formData.kategori_kerusakan,
                        prioritas: formData.prioritas,
                        status: formData.status,
                    },
                ])
                .select('*')
                .single()

            if (pengaduanError) {
                console.error('Error creating pengaduan:', pengaduanError)
                alert(`Gagal membuat pengaduan: ${pengaduanError.message || JSON.stringify(pengaduanError)}`)
                return
            }

            if (!pengaduanData) {
                console.error('No pengaduan data returned')
                alert('Gagal membuat pengaduan: Tidak ada data yang dikembalikan')
                return
            }

            // Add new pengaduan to the list
            setPengaduans([pengaduanData, ...pengaduans])

            // Reset form
            setFormData({
                user_id: '',
                judul: '',
                deskripsi: '',
                lokasi: '',
                sarpras_id: '',
                kategori_kerusakan: 'kerusakan',
                prioritas: 'normal',
                status: 'menunggu',
            })
            setIsModalOpen(false)
            alert('Pengaduan berhasil ditambahkan')
        } catch (err) {
            console.error('Error adding pengaduan:', err)
            alert(`Terjadi kesalahan saat menambahkan pengaduan: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'menunggu':
                return 'bg-yellow-100 text-yellow-800'
            case 'diproses':
                return 'bg-blue-100 text-blue-800'
            case 'selesai':
                return 'bg-green-100 text-green-800'
            case 'ditolak':
                return 'bg-red-100 text-red-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'menunggu':
                return 'Menunggu'
            case 'diproses':
                return 'Diproses'
            case 'selesai':
                return 'Selesai'
            case 'ditolak':
                return 'Ditolak'
            default:
                return status
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
                    <h1 className="text-3xl font-bold text-gray-900">Data Pengaduan</h1>
                    <p className="text-gray-600 mt-2">Kelola semua pengaduan sarana dan prasarana</p>
                </div>
                <Button className="bg-gray-900 hover:bg-gray-800" onClick={() => setIsModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Pengaduan
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Daftar Pengaduan</CardTitle>
                    <CardDescription>Kelola dan monitor semua pengaduan sarpras</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <Input
                            placeholder="Cari berdasarkan judul, deskripsi, pelapor, atau status..."
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
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Judul</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Pelapor</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Sarpras</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Deskripsi</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Status</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Tanggal</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPengaduans.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-8 text-gray-500">
                                            {searchTerm ? 'Tidak ada pengaduan yang sesuai dengan pencarian' : 'Tidak ada pengaduan ditemukan'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPengaduans.map((pengaduan) => {
                                        const profileData = profiles[pengaduan.user_id]
                                        const sarprasData = sarprases[pengaduan.sarpras_id || '']
                                        return (
                                            <tr key={pengaduan.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4 text-gray-900 font-medium">{pengaduan.judul}</td>
                                                <td className="py-3 px-4 text-gray-600">{profileData?.nama_lengkap || '-'}</td>
                                                <td className="py-3 px-4 text-gray-600">
                                                    {sarprasData ? `${sarprasData.kode} - ${sarprasData.nama}` : '-'}
                                                </td>
                                                <td className="py-3 px-4 text-gray-600 text-sm max-w-xs truncate">
                                                    {pengaduan.deskripsi}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(pengaduan.status)}`}>
                                                        {getStatusLabel(pengaduan.status)}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-gray-600 text-xs">
                                                    {new Date(pengaduan.created_at).toLocaleDateString('id-ID')}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => handleDeletePengaduan(pengaduan.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
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
                            Menampilkan <span className="font-semibold">{filteredPengaduans.length}</span> dari{' '}
                            <span className="font-semibold">{pengaduans.length}</span> pengaduan
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Add Pengaduan Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <CardHeader>
                            <CardTitle>Tambah Pengaduan Baru</CardTitle>
                            <CardDescription>Isi form di bawah untuk menambahkan pengaduan baru</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Pelapor</label>
                                <select
                                    value={formData.user_id}
                                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                                >
                                    <option value="">Pilih Pelapor</option>
                                    {Object.entries(profiles).map(([id, profile]) => (
                                        <option key={id} value={id}>
                                            {profile.nama_lengkap}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Judul</label>
                                <Input
                                    type="text"
                                    placeholder="Masukkan judul pengaduan"
                                    value={formData.judul}
                                    onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                                    <select
                                        value={formData.kategori_kerusakan}
                                        onChange={(e) => setFormData({ ...formData, kategori_kerusakan: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    >
                                        <option value="kerusakan">Kerusakan</option>
                                        <option value="hilang">Hilang</option>
                                        <option value="keluhan">Keluhan</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Prioritas</label>
                                    <select
                                        value={formData.prioritas}
                                        onChange={(e) => setFormData({ ...formData, prioritas: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    >
                                        <option value="rendah">Rendah</option>
                                        <option value="normal">Normal</option>
                                        <option value="tinggi">Tinggi</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
                                    <Input
                                        type="text"
                                        placeholder="Lokasi kerusakan"
                                        value={formData.lokasi}
                                        onChange={(e) => setFormData({ ...formData, lokasi: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Sarpras (Opsional)</label>
                                    <select
                                        value={formData.sarpras_id}
                                        onChange={(e) => setFormData({ ...formData, sarpras_id: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    >
                                        <option value="">Pilih Sarpras</option>
                                        {Object.entries(sarprases).map(([id, sarpras]) => (
                                            <option key={id} value={id}>
                                                {sarpras.nama}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                                <textarea
                                    placeholder="Masukkan deskripsi pengaduan"
                                    value={formData.deskripsi}
                                    onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    rows={4}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                                >
                                    <option value="menunggu">Menunggu</option>
                                    <option value="diproses">Diproses</option>
                                    <option value="selesai">Selesai</option>
                                    <option value="ditolak">Ditolak</option>
                                </select>
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
                                    onClick={handleAddPengaduan}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
