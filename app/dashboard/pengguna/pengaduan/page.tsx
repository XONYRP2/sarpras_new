'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { uploadImage } from '@/lib/storage'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Camera } from 'lucide-react'

interface Sarpras {
    id: string
    nama: string
    kode: string
}

interface Pengaduan {
    id: string
    judul: string
    lokasi: string
    sarpras_id: string | null
    prioritas: string
    deskripsi: string
    status: string
    catatan: string | null
    created_at: string
}

export default function PengaduanPage() {
    const router = useRouter()
    const [sarprases, setSarprases] = useState<Record<string, Sarpras>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [userId, setUserId] = useState<string | null>(null)
    const [myPengaduan, setMyPengaduan] = useState<Pengaduan[]>([])
    const [formData, setFormData] = useState({
        judul: '',
        lokasi: '',
        sarpras_id: '',
        prioritas: 'normal',
        deskripsi: '',
    })
    const [fotoFile, setFotoFile] = useState<File | null>(null)
    const [fotoPreview, setFotoPreview] = useState<string | null>(null)
    const [hideFotoPreview, setHideFotoPreview] = useState(false)

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

                if (roleError || !profile) {
                    router.push('/login')
                    return
                }

                if (profile.role !== 'pengguna') {
                    router.push('/dashboard')
                    return
                }

                setUserId(profileId)

                const [{ data: allSarprases, error: sarprasesError }, { data: pengaduanData }] = await Promise.all([
                    supabase
                        .from('sarpras')
                        .select('id, nama, kode')
                        .eq('is_active', true)
                        .order('nama', { ascending: true }),
                    supabase
                        .from('pengaduan')
                        .select('id, judul, lokasi, sarpras_id, prioritas, deskripsi, status, catatan, created_at')
                        .eq('user_id', profileId)
                        .order('created_at', { ascending: false }),
                ])

                if (!sarprasesError && allSarprases) {
                    const sarprasMap: Record<string, Sarpras> = {}
                    allSarprases.forEach((s) => {
                        sarprasMap[s.id] = s
                    })
                    setSarprases(sarprasMap)
                }
                if (pengaduanData) {
                    setMyPengaduan(pengaduanData)
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
        if (!fotoFile) {
            setFotoPreview(null)
            return
        }
        const url = URL.createObjectURL(fotoFile)
        setFotoPreview(url)
        return () => URL.revokeObjectURL(url)
    }, [fotoFile])

    const sarprasOptions = useMemo(() => Object.entries(sarprases), [sarprases])

    const handleSubmit = async () => {
        if (!userId) {
            alert('Pengguna tidak ditemukan. Silakan login ulang.')
            return
        }

        if (!formData.judul.trim() || !formData.lokasi.trim() || !formData.deskripsi.trim()) {
            alert('Subjek, lokasi, dan deskripsi wajib diisi.')
            return
        }

        setIsSubmitting(true)
        try {
            let fotoUrl: string | null = null

            if (fotoFile) {
                const ext = fotoFile.name.split('.').pop() || 'jpg'
                const fileName = `pengaduan/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
                fotoUrl = await uploadImage({
                    bucket: 'SARPRAS',
                    path: fileName,
                    file: fotoFile,
                })
            }

            const { error: pengaduanError } = await supabase
                .from('pengaduan')
                .insert([
                    {
                        user_id: userId,
                        judul: formData.judul.trim(),
                        deskripsi: formData.deskripsi.trim(),
                        lokasi: formData.lokasi.trim(),
                        sarpras_id: formData.sarpras_id || null,
                        foto: fotoUrl,
                        kategori_kerusakan: 'kerusakan',
                        prioritas: formData.prioritas,
                        status: 'menunggu',
                    },
                ])

            if (pengaduanError) {
                console.error('Error creating pengaduan:', pengaduanError)
                alert(`Gagal membuat pengaduan: ${pengaduanError.message || JSON.stringify(pengaduanError)}`)
                return
            }

            setFormData({
                judul: '',
                lokasi: '',
                sarpras_id: '',
                prioritas: 'normal',
                deskripsi: '',
            })
            setFotoFile(null)
            setHideFotoPreview(false)
            alert('Pengaduan berhasil dikirim')
            const { data: pengaduanData } = await supabase
                .from('pengaduan')
                .select('id, judul, lokasi, sarpras_id, prioritas, deskripsi, status, catatan, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
            if (pengaduanData) setMyPengaduan(pengaduanData)
        } catch (err) {
            console.error('Error adding pengaduan:', err)
            alert(`Terjadi kesalahan saat menambahkan pengaduan: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    const getStatusStyle = (status: string) => {
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
                return 'bg-gray-100 text-gray-700'
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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Pengaduan Sarpras</h1>
                <p className="text-gray-600 mt-2">Laporkan kendala sarana dan prasarana dengan detail.</p>
            </div>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Form Pengaduan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-800">Subjek / Judul</label>
                        <Input
                            placeholder="Contoh: AC Lab 1 Tidak Dingin"
                            value={formData.judul}
                            onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-800">Ruangan / Lokasi</label>
                            <Input
                                placeholder="Misal: Lantai 2, Ruang Kelas 12A"
                                value={formData.lokasi}
                                onChange={(e) => setFormData({ ...formData, lokasi: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-800">Prioritas</label>
                            <select
                                value={formData.prioritas}
                                onChange={(e) => setFormData({ ...formData, prioritas: e.target.value })}
                                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-900"
                            >
                                <option value="rendah">Rendah</option>
                                <option value="normal">Normal</option>
                                <option value="tinggi">Tinggi</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-800">Jenis Sarpras (Opsional)</label>
                        <select
                            value={formData.sarpras_id}
                            onChange={(e) => setFormData({ ...formData, sarpras_id: e.target.value })}
                            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-900"
                        >
                            <option value="">Pilih Sarpras Terkait</option>
                            {sarprasOptions.map(([id, sarpras]) => (
                                <option key={id} value={id}>
                                    {sarpras.kode} - {sarpras.nama}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500">Pilih jika pengaduan spesifik pada satu alat.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-800">Deskripsi Masalah</label>
                        <textarea
                            placeholder="Jelaskan secara detail apa yang terjadi..."
                            value={formData.deskripsi}
                            onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                            className="min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-900"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-800">Foto Bukti (Opsional)</label>
                        <div className="flex flex-col gap-4 md:flex-row md:items-center">
                            <div className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
                                {fotoPreview && !hideFotoPreview ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={fotoPreview} alt="Preview" className="h-full w-full rounded-xl object-cover" />
                                ) : (
                                    <Camera className="h-6 w-6 text-gray-400" />
                                )}
                            </div>
                            <div className="flex-1">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setFotoFile(e.target.files?.[0] || null)}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
                                />
                                {fotoPreview && (
                                    <button
                                        type="button"
                                        className="mt-2 text-xs font-semibold text-gray-500 hover:text-gray-700"
                                        onClick={() => setHideFotoPreview(true)}
                                    >
                                        Hapus foto dari tampilan
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <Button
                            className="bg-gray-900 hover:bg-gray-800"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Mengirim...' : 'Kirim Pengaduan'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Riwayat & Feedback Pengaduan</CardTitle>
                </CardHeader>
                <CardContent>
                    {myPengaduan.length === 0 ? (
                        <div className="text-sm text-gray-500">Belum ada pengaduan yang dikirim.</div>
                    ) : (
                        <div className="space-y-4">
                            {myPengaduan.map((item) => {
                                const sarpras = item.sarpras_id ? sarprases[item.sarpras_id] : null
                                return (
                                    <div key={item.id} className="rounded-xl border border-gray-100 bg-white p-4">
                                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <div className="text-sm font-semibold text-gray-900">{item.judul}</div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {new Date(item.created_at).toLocaleDateString('id-ID')} • {item.lokasi}
                                                </div>
                                                {sarpras && (
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {sarpras.kode} - {sarpras.nama}
                                                    </div>
                                                )}
                                            </div>
                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusStyle(item.status)}`}>
                                                {getStatusLabel(item.status)}
                                            </span>
                                        </div>
                                        <div className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">
                                            {item.deskripsi}
                                        </div>
                                        <div className="mt-3 rounded-lg border border-blue-50 bg-blue-50/40 p-3">
                                            <div className="text-xs font-semibold text-blue-700">Feedback Admin/Petugas</div>
                                            <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                                                {item.catatan || 'Belum ada feedback.'}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
