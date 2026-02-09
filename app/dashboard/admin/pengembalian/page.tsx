'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Eye, Search, Plus, CheckCircle2, AlertTriangle, Upload, X, FileText, Check, ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { logActivity } from '@/lib/activity'

/* ================= TYPES ================= */

interface Pengembalian {
    id: string
    peminjaman_id: string
    tanggal_kembali_real: string | null
    petugas_id: string | null
    catatan: string | null
    created_at: string
}

interface Peminjaman {
    id: string
    kode_peminjaman: string | null
    user_id: string
    petugas_id: string | null
    tanggal_pinjam: string | null
    tanggal_kembali_estimasi: string | null
    tujuan: string | null
    status: string
    peminjaman_detail?: {
        jumlah: number,
        sarpras: {
            id: string,
            nama: string,
            kode: string
        }
    }[]
    profiles?: {
        nama_lengkap: string
    }
}

interface Profile {
    id: string
    nama_lengkap: string
}

interface VerificationSection {
    id: number
    jumlah: number
    kondisi: 'baik' | 'cacat' | 'rusak' | 'hilang'
    catatan: string
    file?: File | null
}

const CONDITIONS = [
    { id: 'baik', label: 'BAIK', color: 'bg-green-600 text-white border-green-600 hover:bg-green-700', icon: Check },
    { id: 'cacat', label: 'CACAT', color: 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200', icon: AlertTriangle },
    { id: 'rusak', label: 'RUSAK', color: 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200', icon: X },
    { id: 'hilang', label: 'HILANG', color: 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200', icon: Search },
] as const

/* ================= PAGE ================= */

export default function PengembalianPage() {
    const router = useRouter()
    const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

    // Auth & Data State
    const [userRole, setUserRole] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Data Lists
    const [approvedLoans, setApprovedLoans] = useState<Peminjaman[]>([])
    const [historyReturns, setHistoryReturns] = useState<Pengembalian[]>([])

    // Lookups for History
    const [peminjamans, setPeminjamans] = useState<Record<string, Peminjaman>>({})
    const [profiles, setProfiles] = useState<Record<string, Profile>>({})

    // UI State
    const [activeTab, setActiveTab] = useState<'approved' | 'history'>('approved')
    const [searchTerm, setSearchTerm] = useState('')
    const [detailModal, setDetailModal] = useState<{ isOpen: boolean, data: any }>({ isOpen: false, data: null })

    // Return Process State activeLoanData
    const [activeLoanData, setActiveLoanData] = useState<any>(null)
    const [verifications, setVerifications] = useState<VerificationSection[]>([
        { id: 1, jumlah: 1, kondisi: 'baik', catatan: '' },
    ])

    /* ================= INITIAL FETCH ================= */

    useEffect(() => {
        const fetchData = async () => {
            try {
                const profileId = localStorage.getItem('profileId')
                if (!profileId) { router.push('/login'); return }

                const { data: profile, error: roleError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', profileId)
                    .single()

                if (roleError || !profile || profile.role !== 'admin') {
                    router.push(profile?.role !== 'admin' ? '/dashboard' : '/login')
                    return
                }

                setUserRole(profile.role)

                // 1. Fetch Approved Loans (status = 'disetujui' OR 'dipinjam')
                // Assuming 'disetujui' means ready to be returned (borrowed) or strictly 'dipinjam'
                // Based on standard flow: Pending -> Disetujui -> Dipinjam -> Dikembalikan
                // If the user means loans that are currently OUT, it's usually 'dipinjam'.
                // If they strictly mean 'disetujui' (approved but not yet marked as picked up?), usually returns happen after pickup.
                // WE WILL FETCH 'dipinjam' as context implies processing returns of items currently out.
                // However, user specifically said "peminjaman yang telah disetujui". 
                // In many systems 'disetujui' is the state before 'dipinjam' (handed over).
                // But for a Return menu, it only makes sense to return items that are 'dipinjam'. 
                // I will include both for safety or stick to 'dipinjam' if that's the active state.
                // Let's assume the user considers 'dipinjam' as the state of "approved and goods taken".

                const { data: loanData, error: loanError } = await supabase
                    .from('peminjaman')
                    .select(`
                        *,
                        profiles!peminjaman_user_id_fkey(nama_lengkap),
                        peminjaman_detail(
                            jumlah,
                            sarpras(id, nama, kode)
                        )
                    `)
                    .in('status', ['dipinjam', 'disetujui']) // Fetching both just in case, logic usually filters 'dipinjam' for returns
                    .order('tanggal_pinjam', { ascending: false })

                if (loanData) {
                    // Filter to ensure we only process reasonable statuses for RETURN
                    // Usually you render 'dipinjam' here.
                    setApprovedLoans(loanData)
                }

                // 2. Fetch Return History
                const { data: returnData } = await supabase
                    .from('pengembalian')
                    .select('*')
                    .order('tanggal_kembali_real', { ascending: false })

                if (returnData) {
                    setHistoryReturns(returnData)

                    // Fetch related data needed for history list rendering
                    const { data: allPeminjamans } = await supabase.from('peminjaman').select('*')
                    if (allPeminjamans) {
                        const pMap: Record<string, Peminjaman> = {}
                        allPeminjamans.forEach(p => pMap[p.id] = p)
                        setPeminjamans(pMap)

                        const uIds = [...new Set([...returnData.map(p => p.petugas_id), ...allPeminjamans.map(p => p.user_id)].filter(Boolean))]
                        if (uIds.length > 0) {
                            const { data: allProfiles } = await supabase.from('profiles').select('id, nama_lengkap').in('id', uIds)
                            if (allProfiles) {
                                const profMap: Record<string, Profile> = {}
                                allProfiles.forEach(p => profMap[p.id] = p)
                                setProfiles(profMap)
                            }
                        }
                    }
                }

            } catch (err) {
                console.error(err)
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [router])

    /* ================= ACTIONS ================= */

    const handleProcessReturn = (loan: any) => {
        setActiveLoanData(loan)
        const borrowedAmount = loan.peminjaman_detail?.[0]?.jumlah ?? 1
        setVerifications([{ id: 1, jumlah: borrowedAmount, kondisi: 'baik', catatan: '' }])
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const addVerification = () => {
        const newId = (verifications.at(-1)?.id ?? 0) + 1
        const borrowed = activeLoanData?.peminjaman_detail?.[0]?.jumlah ?? 0
        const used = verifications.reduce((a, b) => a + b.jumlah, 0)
        const remaining = Math.max(0, borrowed - used)
        if (remaining === 0) return
        setVerifications([...verifications, { id: newId, jumlah: remaining, kondisi: 'baik', catatan: '' }])
    }

    const updateVerification = (id: number, field: keyof VerificationSection, value: any) => {
        setVerifications(v => v.map(item => (item.id === id ? { ...item, [field]: value } : item)))
    }

    const removeVerification = (id: number) => {
        if (verifications.length <= 1) return
        setVerifications(v => v.filter(item => item.id !== id))
    }

    const handleFileChange = (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
        updateVerification(id, 'file', e.target.files?.[0] ?? null)
    }

    const handleSubmitReturn = async () => {
        if (!activeLoanData) return
        const borrowed = activeLoanData.peminjaman_detail?.[0]?.jumlah ?? 0
        const total = verifications.reduce((a, b) => a + b.jumlah, 0)

        if (total !== borrowed) {
            alert(`Total barang kembali (${total}) tidak sesuai dengan dipinjam (${borrowed}).`)
            return
        }

        if (!confirm('Simpan data pengembalian ini?')) return
        setIsLoading(true)

        try {
            const profileId = localStorage.getItem('profileId')

            // 1. Insert Pengembalian
            const { data: pengembalian, error: e1 } = await supabase
                .from('pengembalian')
                .insert({
                    peminjaman_id: activeLoanData.id,
                    petugas_id: profileId,
                    tanggal_kembali_real: new Date().toISOString(),
                    catatan: verifications.map(v => `[${v.kondisi.toUpperCase()} - ${v.jumlah}] ${v.catatan}`).join('\n')
                })
                .select()
                .single()
            if (e1) throw e1

            // 2. Insert Details
            const detailPayload = verifications.map(v => ({
                pengembalian_id: pengembalian.id,
                sarpras_id: activeLoanData.peminjaman_detail[0].sarpras.id,
                jumlah: v.jumlah,
                kondisi: v.kondisi,
                deskripsi: v.catatan,
                damage_detected: v.kondisi !== 'baik',
                kategori_kerusakan: v.kondisi === 'cacat' ? 'ringan' : v.kondisi === 'rusak' ? 'berat' : null,
            }))
            const { error: e2 } = await supabase.from('pengembalian_detail').insert(detailPayload)
            if (e2) throw e2

            // 3. Update Peminjaman -> dikembalikan
            const { error: e3 } = await supabase
                .from('peminjaman')
                .update({ status: 'dikembalikan', tanggal_kembali_real: new Date().toISOString() })
                .eq('id', activeLoanData.id)
            if (e3) throw e3

            // 4. Update Stock (Increase) - exclude items marked as 'hilang'
            const sarprasId = activeLoanData.peminjaman_detail?.[0]?.sarpras?.id
            const returnedCount = verifications
                .filter(v => v.kondisi !== 'hilang')
                .reduce((a, b) => a + b.jumlah, 0)

            if (sarprasId && returnedCount > 0) {
                const { data: current, error: eStock } = await supabase
                    .from('sarpras')
                    .select('stok_tersedia')
                    .eq('id', sarprasId)
                    .single()
                if (eStock || !current) throw eStock || new Error('Gagal mengambil stok sarpras')

                const { error: e4 } = await supabase
                    .from('sarpras')
                    .update({ stok_tersedia: (current.stok_tersedia ?? 0) + returnedCount })
                    .eq('id', sarprasId)
                if (e4) throw e4
            }

            await logActivity({
                userId: profileId,
                action: 'update',
                module: 'pengembalian',
                description: `Memproses pengembalian ${activeLoanData?.kode_peminjaman || activeLoanData?.id}`,
                dataAfter: { peminjaman_id: activeLoanData?.id, status: 'dikembalikan' },
            })

            alert('Pengembalian berhasil diproses!')
            window.location.reload()

        } catch (err: any) {
            alert('Gagal: ' + err.message)
            setIsLoading(false)
        }
    }

    /* ================= RENDER ================= */

    const filteredApproved = approvedLoans.filter(l =>
        l.profiles?.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.kode_peminjaman?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.peminjaman_detail?.[0]?.sarpras?.nama.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const filteredHistory = historyReturns.filter(r => {
        const loan = peminjamans[r.peminjaman_id]
        const user = profiles[loan?.user_id || '']
        return (
            loan?.kode_peminjaman?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user?.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase())
        )
    })

    if (isLoading && approvedLoans.length === 0) return <div className="p-8 text-center">Loading...</div>

    return (
        <div className="space-y-8 pb-10">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Pengembalian Barang</h1>
                <p className="text-gray-600 mt-2">Kelola pengembalian dari peminjaman yang telah berjalan.</p>
            </div>

            {/* TAB SECTION */}
            {!activeLoanData && (
                <div className="flex flex-col space-y-4">
                    <div className="flex items-center gap-4 border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab('approved')}
                            className={cn("px-4 py-3 text-sm font-semibold border-b-2 transition-colors",
                                activeTab === 'approved' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700")}
                        >
                            Peminjaman Berjalan ({approvedLoans.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={cn("px-4 py-3 text-sm font-semibold border-b-2 transition-colors",
                                activeTab === 'history' ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700")}
                        >
                            Riwayat Pengembalian
                        </button>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                            placeholder={activeTab === 'approved' ? "Cari peminjam, barang, atau kode..." : "Cari riwayat..."}
                            className="pl-9 bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* TABLE: APPROVED LOANS */}
                    {activeTab === 'approved' && (
                        <Card>
                            <CardContent className="p-0 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-semibold border-b">
                                            <tr>
                                                <th className="px-6 py-4">Kode Peminjaman</th>
                                                <th className="px-6 py-4">Peminjam</th>
                                                <th className="px-6 py-4">Barang</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4 text-right">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredApproved.length === 0 ? (
                                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Tidak ada data peminjaman aktif.</td></tr>
                                            ) : (
                                                filteredApproved.map(loan => (
                                                    <tr key={loan.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-6 py-4 font-mono text-blue-600 font-medium">{loan.kode_peminjaman}</td>
                                                        <td className="px-6 py-4 font-medium">{loan.profiles?.nama_lengkap}</td>
                                                        <td className="px-6 py-4 text-gray-600">
                                                            {loan.peminjaman_detail?.[0]?.sarpras?.nama}
                                                            <span className="text-gray-400 ml-1">({loan.peminjaman_detail?.[0]?.jumlah})</span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold uppercase",
                                                                loan.status === 'dipinjam' ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                                                            )}>
                                                                {loan.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <Button size="sm" onClick={() => handleProcessReturn(loan)} className="bg-blue-600 hover:bg-blue-700">
                                                                Proses <ArrowRight className="w-4 h-4 ml-1" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* TABLE: HISTORY */}
                    {activeTab === 'history' && (
                        <Card>
                            <CardContent className="p-0 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-semibold border-b">
                                            <tr>
                                                <th className="px-6 py-4">Tanggal</th>
                                                <th className="px-6 py-4">Kode Peminjaman</th>
                                                <th className="px-6 py-4">Peminjam</th>
                                                <th className="px-6 py-4">Petugas</th>
                                                <th className="px-6 py-4 text-right">Detail</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredHistory.length === 0 ? (
                                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Belum ada riwayat.</td></tr>
                                            ) : (
                                                filteredHistory.map(item => {
                                                    const loan = peminjamans[item.peminjaman_id]
                                                    const user = profiles[loan?.user_id || '']
                                                    const officer = profiles[item.petugas_id || '']
                                                    return (
                                                        <tr key={item.id} className="hover:bg-gray-50">
                                                            <td className="px-6 py-4 text-gray-600">
                                                                {item.tanggal_kembali_real ? new Date(item.tanggal_kembali_real).toLocaleDateString('id-ID') : '-'}
                                                            </td>
                                                            <td className="px-6 py-4 font-mono">{loan?.kode_peminjaman || '-'}</td>
                                                            <td className="px-6 py-4 font-medium">{user?.nama_lengkap || '-'}</td>
                                                            <td className="px-6 py-4 text-gray-500">{officer?.nama_lengkap || '-'}</td>
                                                            <td className="px-6 py-4 text-right">
                                                                <Button variant="ghost" size="sm" onClick={() => setDetailModal({ isOpen: true, data: { ...item, peminjaman: loan, user, officer } })}>
                                                                    <Eye className="w-4 h-4 text-blue-600" />
                                                                </Button>
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
                    )}
                </div>
            )}

            {/* RETURN PROCESSING FORM */}
            {activeLoanData && (
                <div className="animate-in slide-in-from-bottom-4 duration-500 pt-4">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <Button variant="ghost" className="pl-0 text-gray-500 hover:text-gray-900 mb-2" onClick={() => setActiveLoanData(null)}>
                                &larr; Kembali ke daftar
                            </Button>
                            <h2 className="text-2xl font-bold text-gray-900">Proses Pengembalian</h2>
                            <p className="text-gray-500">Kode: <span className="font-mono font-bold text-blue-600">{activeLoanData.kode_peminjaman}</span></p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* INFO CARD */}
                        <Card className="h-fit rounded-2xl border-blue-100 shadow-sm">
                            <CardHeader className="bg-blue-50/50 pb-4 border-b border-blue-50">
                                <CardTitle className="text-base text-blue-900">Informasi Barang</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase">Peminjam</label>
                                    <p className="font-medium text-lg">{activeLoanData.profiles?.nama_lengkap}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase">Barang</label>
                                    <p className="font-medium text-gray-900">{activeLoanData.peminjaman_detail?.[0]?.sarpras?.nama}</p>
                                    <p className="text-sm text-gray-500 font-mono">{activeLoanData.peminjaman_detail?.[0]?.sarpras?.kode}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase">Jumlah Dipinjam</label>
                                    <p className="font-bold text-xl text-blue-600">{activeLoanData.peminjaman_detail?.[0]?.jumlah} Unit</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* VERIFICATION FORM */}
                        <div className="lg:col-span-2 space-y-6">
                            {verifications.map((v, i) => (
                                <Card key={v.id} className="border-gray-200 shadow-sm rounded-2xl overflow-hidden">
                                    <div className="bg-gray-900 text-white px-6 py-3 flex justify-between items-center">
                                        <h3 className="font-bold text-sm">Pemeriksaan Unit #{i + 1}</h3>
                                        {verifications.length > 1 && (
                                            <button onClick={() => removeVerification(v.id)} className="text-gray-400 hover:text-red-400"><X className="w-4 h-4" /></button>
                                        )}
                                    </div>
                                    <CardContent className="p-6 grid gap-6">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="mb-2 block text-xs font-bold text-gray-500 uppercase">Jumlah Dikembalikan</label>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    className="h-12 text-lg font-bold"
                                                    value={v.jumlah}
                                                    onChange={(e) => updateVerification(v.id, 'jumlah', parseInt(e.target.value) || 0)}
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-2 block text-xs font-bold text-gray-500 uppercase">Kondisi Barang</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {CONDITIONS.map(c => (
                                                        <button
                                                            key={c.id}
                                                            onClick={() => updateVerification(v.id, 'kondisi', c.id)}
                                                            className={cn("flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-bold border transition-all",
                                                                v.kondisi === c.id ? c.color : "bg-white text-gray-500 hover:bg-gray-50"
                                                            )}
                                                        >
                                                            <c.icon className="w-3 h-3" /> {c.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-xs font-bold text-gray-500 uppercase">Catatan & Bukti (Opsional)</label>
                                            <Textarea
                                                placeholder="Keterangan kondisi..."
                                                className="mb-3"
                                                value={v.catatan}
                                                onChange={(e) => updateVerification(v.id, 'catatan', e.target.value)}
                                            />
                                            <div
                                                className="border-2 border-dashed border-gray-200 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                                                onClick={() => fileInputRefs.current[v.id]?.click()}
                                            >
                                                <div className="bg-blue-50 text-blue-600 p-2 rounded-lg"><Upload className="w-4 h-4" /></div>
                                                <span className="text-sm text-gray-600 font-medium">{v.file ? v.file.name : "Upload Foto Kondisi"}</span>
                                            </div>
                                            <input
                                                type="file"
                                                hidden
                                                ref={(el) => { fileInputRefs.current[v.id] = el }}
                                                onChange={(e) => handleFileChange(v.id, e)}
                                                accept="image/*"
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            <div className="flex gap-4 pt-4">
                                <Button variant="outline" className="h-12 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50" onClick={addVerification}>
                                    <Plus className="w-4 h-4 mr-2" /> Tambah Kondisi Lain
                                </Button>
                                <Button className="h-12 flex-1 bg-green-600 hover:bg-green-700 text-white font-bold text-lg" onClick={handleSubmitReturn}>
                                    <CheckCircle2 className="w-5 h-5 mr-2" /> Konfirmasi Pengembalian
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAIL MODAL */}
            {detailModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md shadow-2xl">
                        <CardHeader className="flex flex-row justify-between items-center">
                            <CardTitle>Detail Pengembalian</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setDetailModal({ isOpen: false, data: null })}><X /></Button>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-0">
                            <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Kode Peminjaman</span>
                                    <span className="font-mono font-bold">{detailModal.data.peminjaman?.kode_peminjaman}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Peminjam</span>
                                    <span className="font-medium">{detailModal.data.user?.nama_lengkap}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Tanggal Kembali</span>
                                    <span className="font-medium text-green-600">{new Date(detailModal.data.tanggal_kembali_real).toLocaleDateString('id-ID')}</span>
                                </div>
                            </div>
                            <div>
                                <h4 className="font-bold text-sm mb-2">Catatan Petugas</h4>
                                <p className="text-sm text-gray-600 bg-white border p-3 rounded-lg whitespace-pre-wrap">
                                    {detailModal.data.catatan || '-'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
