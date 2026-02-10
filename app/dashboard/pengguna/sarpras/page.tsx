'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Search, MapPin, ShoppingCart } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

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
    foto?: string | null
    created_at: string
    updated_at: string
}

interface BorrowFormData {
    jumlah: number
    tanggal_pinjam: string
    tanggal_kembali_estimasi: string
    tujuan: string
}

interface Kategori {
    id: string
    nama: string
}

interface Lokasi {
    id: string
    nama_lokasi: string
}

export default function SarprasPage() {
    const router = useRouter()
    const [sarprases, setSarprases] = useState<Sarpras[]>([])
    const [kategoris, setKategoris] = useState<Record<string, Kategori>>({})
    const [lokasis, setLokasis] = useState<Record<string, Lokasi>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [userRole, setUserRole] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string>('Semua')
    const [filteredSarprases, setFilteredSarprases] = useState<Sarpras[]>([])

    // Borrow Modal State
    const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false)
    const [selectedSarpras, setSelectedSarpras] = useState<Sarpras | null>(null)
    const formatDateLocal = (date: Date = new Date()) => {
        const y = date.getFullYear()
        const m = String(date.getMonth() + 1).padStart(2, '0')
        const d = String(date.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
    }

    const isWeekend = (dateStr: string) => {
        if (!dateStr) return false
        const [y, m, d] = dateStr.split('-').map(Number)
        if (!y || !m || !d) return false
        const day = new Date(y, m - 1, d).getDay()
        return day === 0 || day === 6
    }

    const [borrowFormData, setBorrowFormData] = useState<BorrowFormData>({
        jumlah: 1,
        tanggal_pinjam: formatDateLocal(),
        tanggal_kembali_estimasi: '',
        tujuan: ''
    })
    const [isSubmitting, setIsSubmitting] = useState(false)

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

                if (profile.role !== 'pengguna') {
                    router.push('/dashboard')
                    return
                }

                setUserRole(profile.role)

                // Fetch all sarpras
                const { data: allSarpras, error: sarprasError } = await supabase
                    .from('sarpras')
                    .select('id, kode, nama, kategori_id, lokasi_id, stok_total, stok_tersedia, kondisi, merk, foto, created_at, updated_at')
                    .eq('is_active', true)
                    .order('created_at', { ascending: false })

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
    }, [router])

    useEffect(() => {
        const filtered = sarprases.filter((sarpras) => {
            const kategori = kategoris[sarpras.kategori_id || '']
            const lokasi = lokasis[sarpras.lokasi_id || '']
            const searchLower = searchTerm.toLowerCase()
            const matchesSearch =
                sarpras.kode.toLowerCase().includes(searchLower) ||
                sarpras.nama.toLowerCase().includes(searchLower) ||
                (kategori?.nama || '').toLowerCase().includes(searchLower) ||
                (lokasi?.nama_lokasi || '').toLowerCase().includes(searchLower) ||
                (sarpras.merk || '').toLowerCase().includes(searchLower)

            const matchesCategory = selectedCategory === 'Semua' || kategori?.nama === selectedCategory

            return matchesSearch && matchesCategory
        })
        setFilteredSarprases(filtered)
    }, [searchTerm, selectedCategory, sarprases, kategoris, lokasis])

    const getConditionColor = (kondisi: string) => {
        switch (kondisi) {
            case 'baik': return 'bg-green-500 text-white'
            case 'rusak_ringan': return 'bg-yellow-500 text-white'
            case 'rusak_berat': return 'bg-red-500 text-white'
            default: return 'bg-gray-500 text-white'
        }
    }

    const getConditionLabel = (kondisi: string) => {
        switch (kondisi) {
            case 'baik': return 'Baik'
            case 'rusak_ringan': return 'Rusak Ringan'
            case 'rusak_berat': return 'Rusak Berat'
            default: return kondisi
        }
    }

    const getCardColor = (itemName: string) => {
        // Simple hash to pick a color, stable per item name
        const colors = ['bg-blue-600', 'bg-orange-500', 'bg-purple-600', 'bg-emerald-600', 'bg-pink-600']
        let hash = 0
        for (let i = 0; i < itemName.length; i++) {
            hash = itemName.charCodeAt(i) + ((hash << 5) - hash)
        }
        return colors[Math.abs(hash) % colors.length]
    }

    const handleBorrowClick = (sarpras: Sarpras) => {
        setSelectedSarpras(sarpras)
        setBorrowFormData({
            jumlah: 1,
            tanggal_pinjam: formatDateLocal(),
            tanggal_kembali_estimasi: '',
            tujuan: ''
        })
        setIsBorrowModalOpen(true)
    }

    const handleSubmitBorrow = async () => {
        if (!selectedSarpras) return

        if (
            !borrowFormData.tanggal_pinjam ||
            !borrowFormData.tanggal_kembali_estimasi ||
            !borrowFormData.tujuan
        ) {
            alert('Mohon lengkapi semua field yang wajib diisi')
            return
        }

        if (isWeekend(borrowFormData.tanggal_pinjam) || isWeekend(borrowFormData.tanggal_kembali_estimasi)) {
            alert('Tanggal peminjaman/pengembalian tidak boleh hari Sabtu atau Minggu.')
            return
        }

        if (
            borrowFormData.jumlah < 1 ||
            borrowFormData.jumlah > selectedSarpras.stok_tersedia
        ) {
            alert('Jumlah pinjam tidak valid')
            return
        }

        setIsSubmitting(true)

        try {
            const profileId = localStorage.getItem('profileId')
            if (!profileId) throw new Error('User not found')

            /* ===============================
               1️⃣ INSERT KE TABEL PEMINJAMAN
               (TANPA kolom jumlah)
               =============================== */
            const { data: peminjaman, error: peminjamanError } = await supabase
                .from('peminjaman')
                .insert({
                    user_id: profileId,
                    tanggal_pinjam: borrowFormData.tanggal_pinjam,
                    tanggal_kembali_estimasi: borrowFormData.tanggal_kembali_estimasi,
                    tujuan: borrowFormData.tujuan,
                    status: 'menunggu',
                })
                .select()
                .single()

            if (peminjamanError) throw peminjamanError

            /* ===============================
               2️⃣ INSERT KE PEMINJAMAN_DETAIL
               (JUMLAH MASUK DI SINI)
               =============================== */
            const { error: detailError } = await supabase
                .from('peminjaman_detail')
                .insert({
                    peminjaman_id: peminjaman.id,
                    sarpras_id: selectedSarpras.id,
                    jumlah: borrowFormData.jumlah,
                    kondisi_pinjam: selectedSarpras.kondisi,
                    catatan: borrowFormData.tujuan,
                })

            if (detailError) throw detailError

            alert('Pengajuan peminjaman berhasil dikirim!')
            setIsBorrowModalOpen(false)

        } catch (error: any) {
            console.error('Error submitting borrow request:', error)
            alert(`Gagal mengajukan peminjaman: ${error.message}`)
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

    if (userRole !== 'pengguna') {
        return (
            <div className="flex items-center justify-center min-h-96">
                <div className="text-red-600">Access Denied</div>
            </div>
        )
    }

    const categoryList = ['Semua', ...new Set(Object.values(kategoris).map(k => k.nama))]

    return (
        <div className="space-y-8 p-4">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Sarpras Tersedia</h1>
                <p className="text-gray-500 mt-2 text-lg">Pilih sarana atau prasarana yang ingin Anda pinjam.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                        placeholder="Cari alat atau buku..."
                        className="pl-12 h-12 rounded-full border-gray-200 shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    {categoryList.map(category => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={cn(
                                "px-6 py-2 rounded-full text-sm font-medium transition-all duration-200",
                                selectedCategory === category
                                    ? "bg-gray-900 text-white shadow-md transform scale-105"
                                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                            )}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            {filteredSarprases.length === 0 ? (
                <div className="text-center py-16">
                    <div className="text-gray-400 mb-4">
                        <Search className="w-16 h-16 mx-auto opacity-20" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Tidak ada sarpras ditemukan</h3>
                    <p className="text-gray-500 mt-1">Coba kata kunci pencarian lain atau ganti kategori.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredSarprases.map((sarpras) => {
                        const kategori = kategoris[sarpras.kategori_id || '']
                        const lokasi = lokasis[sarpras.lokasi_id || '']
                        const cardColor = getCardColor(sarpras.nama)

                        return (
                            <div key={sarpras.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex flex-col">
                                {/* Top colored section */}
                                <div className={cn("h-48 relative p-6 flex items-center justify-center", cardColor)}>
                                    <div className="absolute top-4 left-4 flex flex-col gap-2 items-start">
                                        <span className="bg-white/90 backdrop-blur text-xs font-semibold px-3 py-1 rounded-full text-gray-800 shadow-sm">
                                            {kategori?.nama || 'Umum'}
                                        </span>
                                        <span className={cn("text-[10px] font-bold px-3 py-1 rounded-full shadow-sm", getConditionColor(sarpras.kondisi))}>
                                            {getConditionLabel(sarpras.kondisi)}
                                        </span>
                                    </div>
                                    {sarpras.foto ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={sarpras.foto}
                                            alt={sarpras.nama}
                                            className="absolute inset-0 h-full w-full object-cover opacity-70"
                                        />
                                    ) : (
                                        <span className="text-8xl font-black text-white opacity-20 select-none transform group-hover:scale-110 transition-transform duration-500">
                                            {sarpras.nama.charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>

                                {/* Content section */}
                                <div className="p-6 flex flex-col gap-4 flex-1">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                                            {sarpras.nama}
                                        </h3>
                                        <div className="flex items-center gap-1 mt-1 text-gray-400 text-xs font-mono">
                                            <span className="truncate max-w-[200px]">{sarpras.kode}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 mt-auto">
                                        <div className="flex items-center gap-2 text-gray-500 text-sm">
                                            <MapPin className="w-4 h-4 text-red-400" />
                                            <span>{lokasi?.nama_lokasi || 'Tidak diketahui'}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                            <span className="text-sm font-medium text-blue-600">Tersedia</span>
                                            <span className="text-sm font-bold text-gray-900">{sarpras.stok_tersedia} Unit</span>
                                        </div>
                                    </div>

                                    <Button
                                        className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 shadow-blue-200 shadow-lg hover:shadow-blue-300 transition-all active:scale-95"
                                        onClick={() => handleBorrowClick(sarpras)}
                                        disabled={sarpras.stok_tersedia <= 0}
                                    >
                                        <ShoppingCart className="w-5 h-5 mr-2" />
                                        {sarpras.stok_tersedia > 0 ? 'Pinjam Sekarang' : 'Stok Habis'}
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Borrow Modal */}
            {isBorrowModalOpen && selectedSarpras && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]">
                        {/* Left Side - Item Details */}
                        <div className="w-full md:w-1/3 bg-gray-50 border-r border-gray-100 p-8 flex flex-col gap-6">
                            <div className={cn("aspect-square rounded-2xl flex items-center justify-center shadow-inner overflow-hidden", getCardColor(selectedSarpras.nama))}>
                                {selectedSarpras.foto ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={selectedSarpras.foto}
                                        alt={selectedSarpras.nama}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <span className="text-8xl font-black text-white/30 select-none">
                                        {selectedSarpras.nama.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>

                            <div>
                                <h3 className="text-2xl font-bold text-gray-900">{selectedSarpras.nama}</h3>
                                <p className="text-sm text-gray-500 font-mono mt-1">{selectedSarpras.kode}</p>
                            </div>

                            <div className="space-y-4 text-sm">
                                <div className="flex justify-between py-2 border-b border-gray-200">
                                    <span className="text-gray-500">Kategori</span>
                                    <span className="font-medium text-gray-900 text-right">{kategoris[selectedSarpras.kategori_id || '']?.nama || '-'}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-200">
                                    <span className="text-gray-500">Lokasi</span>
                                    <span className="font-medium text-gray-900 text-right">{lokasis[selectedSarpras.lokasi_id || '']?.nama_lokasi || '-'}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-200">
                                    <span className="text-gray-500">Tersedia</span>
                                    <span className="font-bold text-gray-900">{selectedSarpras.stok_tersedia} Unit</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-blue-100 bg-blue-50 px-3 -mx-3 rounded-lg">
                                    <span className="text-blue-600 font-medium">Bisa Dipinjam</span>
                                    <span className="font-bold text-blue-700">{selectedSarpras.stok_tersedia} Unit</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Side - Form */}
                        <div className="flex-1 p-8 overflow-y-auto">
                            <div className="mb-6">
                                <h2 className="text-xl font-bold text-gray-900">Ajukan Peminjaman</h2>
                                <p className="text-gray-500 text-sm mt-1">Isi formulir di bawah ini untuk meminjam sarana/prasarana.</p>
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">Jumlah Pinjam</label>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={selectedSarpras.stok_tersedia}
                                            value={borrowFormData.jumlah}
                                            onChange={(e) => setBorrowFormData({ ...borrowFormData, jumlah: parseInt(e.target.value) || 1 })}
                                            className="rounded-xl border-gray-200 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                        <p className="text-xs text-gray-400">Maks bisa dipinjam: {selectedSarpras.stok_tersedia}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">Tanggal Pinjam</label>
                                        <div className="relative">
                                            <Input
                                                type="date"
                                                step={1}
                                                value={borrowFormData.tanggal_pinjam}
                                                onChange={(e) => {
                                                    const next = e.target.value
                                                    if (isWeekend(next)) {
                                                        alert('Tanggal pinjam tidak boleh hari Sabtu atau Minggu.')
                                                        return
                                                    }
                                                    setBorrowFormData({ ...borrowFormData, tanggal_pinjam: next })
                                                }}
                                                className="rounded-xl border-gray-200 focus:ring-blue-500 focus:border-blue-500 block w-full"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Estimasi Pengembalian</label>
                                    <Input
                                        type="date"
                                        min={borrowFormData.tanggal_pinjam}
                                        step={1}
                                        value={borrowFormData.tanggal_kembali_estimasi}
                                        onChange={(e) => {
                                            const next = e.target.value
                                            if (isWeekend(next)) {
                                                alert('Tanggal pengembalian tidak boleh hari Sabtu atau Minggu.')
                                                return
                                            }
                                            setBorrowFormData({ ...borrowFormData, tanggal_kembali_estimasi: next })
                                        }}
                                        className="rounded-xl border-gray-200 focus:ring-blue-500 focus:border-blue-500 w-full"
                                    />
                                    <p className="text-xs text-gray-400">Kapan Anda berencana mengembalikan item ini?</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Tujuan Peminjaman</label>
                                    <textarea
                                        value={borrowFormData.tujuan}
                                        onChange={(e) => setBorrowFormData({ ...borrowFormData, tujuan: e.target.value })}
                                        className="w-full min-h-[120px] rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                        placeholder="Misal: Untuk kegiatan praktikum di Lab Komputer"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 mt-8 pt-6 border-t border-gray-100">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsBorrowModalOpen(false)}
                                    className="flex-1 rounded-xl border-gray-200 hover:bg-gray-50 hover:text-gray-900 text-gray-700"
                                    disabled={isSubmitting}
                                >
                                    Batal
                                </Button>
                                <Button
                                    onClick={handleSubmitBorrow}
                                    className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Mengajukan...' : 'Ajukan Sekarang'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
