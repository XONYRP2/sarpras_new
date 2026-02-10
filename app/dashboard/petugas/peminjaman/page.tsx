'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Eye, Search, MoreVertical, X, CheckCircle, XCircle, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn } from '@/lib/utils'
import { logActivity } from '@/lib/activity'

interface Sarpras {
    id: string
    nama: string
    kode: string
}

interface PeminjamanDetail {
    jumlah: number
    sarpras: Sarpras
    kondisi_pinjam: string
    catatan: string
}

interface Profile {
    nama_lengkap: string
    email?: string
}

interface Peminjaman {
    id: string
    kode_peminjaman: string
    user_id: string
    tanggal_pinjam: string
    tanggal_kembali_estimasi: string
    status: string
    tujuan: string
    profiles: Profile
    peminjaman_detail: PeminjamanDetail[]
    created_at: string
}

export default function PeminjamanPage() {
    const router = useRouter()
    const [peminjamans, setPeminjamans] = useState<Peminjaman[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterStatus, setFilterStatus] = useState<string>('SEMUA')
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // Modals
    const [detailModalOpen, setDetailModalOpen] = useState(false)
    const [selectedLoan, setSelectedLoan] = useState<Peminjaman | null>(null)
    const [rejectModalOpen, setRejectModalOpen] = useState(false)
    const [rejectReason, setRejectReason] = useState('')
    const [printModalOpen, setPrintModalOpen] = useState(false)
    const [printLoan, setPrintLoan] = useState<Peminjaman | null>(null)

    const fetchData = async () => {
        try {
            const profileId = localStorage.getItem('profileId')
            if (!profileId) {
                router.push('/login')
                return
            }

            // Fetch user role
            const { data: profile, error: roleError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', profileId)
                .single()

            if (roleError || !profile || profile.role !== 'petugas') {
                router.push('/dashboard')
                return
            }

            // Fetch peminjamans with relations
            const { data, error } = await supabase
                .from('peminjaman')
                .select(`
                    *,
                    profiles:user_id (nama_lengkap, email),
                    peminjaman_detail (
                        jumlah,
                        kondisi_pinjam,
                        catatan,
                        sarpras:sarpras_id (id, nama, kode)
                    )
                `)
                .order('created_at', { ascending: false })

            if (error) throw error

            setPeminjamans(data || [])
        } catch (err) {
            console.error('Error fetching data:', err)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [router])

    const handleApprove = async (id: string) => {
        if (!confirm('Apakah Anda yakin ingin menyetujui peminjaman ini?')) return
        setActionLoading(id)
        try {
            const profileId = localStorage.getItem('profileId')
            const loan = peminjamans.find(p => p.id === id)
            if (!loan) {
                throw new Error('Data peminjaman tidak ditemukan')
            }

            const previousStocks: Array<{ id: string, stok_tersedia: number }> = []
            for (const detail of loan.peminjaman_detail) {
                const sarprasId = detail.sarpras?.id
                if (!sarprasId) continue

                const { data: current, error: eStock } = await supabase
                    .from('sarpras')
                    .select('stok_tersedia')
                    .eq('id', sarprasId)
                    .single()

                if (eStock || !current) throw eStock || new Error('Gagal mengambil stok sarpras')
                if (current.stok_tersedia < detail.jumlah) {
                    throw new Error(`Stok ${detail.sarpras?.nama || 'sarpras'} tidak mencukupi`)
                }

                previousStocks.push({ id: sarprasId, stok_tersedia: current.stok_tersedia })

                const { error: eUpdate } = await supabase
                    .from('sarpras')
                    .update({ stok_tersedia: current.stok_tersedia - detail.jumlah })
                    .eq('id', sarprasId)

                if (eUpdate) throw eUpdate
            }

            const { error } = await supabase
                .from('peminjaman')
                .update({
                    status: 'disetujui',
                    petugas_approval_id: profileId,
                    tanggal_approval: new Date().toISOString()
                })
                .eq('id', id)

            if (error) {
                await Promise.all(
                    previousStocks.map(s =>
                        supabase.from('sarpras').update({ stok_tersedia: s.stok_tersedia }).eq('id', s.id)
                    )
                )
                throw error
            }
            await logActivity({
                userId: profileId,
                action: 'update',
                module: 'peminjaman',
                description: `Menyetujui peminjaman ${loan.kode_peminjaman || loan.id}`,
                dataAfter: { status: 'disetujui', peminjaman_id: loan.id },
            })

            setPrintLoan(loan)
            setPrintModalOpen(true)
            fetchData()
        } catch (err: any) {
            alert('Gagal menyetujui: ' + err.message)
        } finally {
            setActionLoading(null)
        }
    }

    const handleReject = async () => {
        if (!selectedLoan || !rejectReason.trim()) return
        setActionLoading(selectedLoan.id)
        try {
            const profileId = localStorage.getItem('profileId')
            const { error } = await supabase
                .from('peminjaman')
                .update({
                    status: 'ditolak',
                    alasan_penolakan: rejectReason,
                    petugas_approval_id: profileId,
                    tanggal_approval: new Date().toISOString()
                })
                .eq('id', selectedLoan.id)

            if (error) throw error
            setRejectModalOpen(false)
            setRejectReason('')
            fetchData()
        } catch (err: any) {
            alert('Gagal menolak: ' + err.message)
        } finally {
            setActionLoading(null)
            setSelectedLoan(null)
        }
    }

    const handleCancel = async (id: string) => {
        if (!confirm('Apakah Anda yakin ingin membatalkan (menghapus) permohonan ini?')) return
        setActionLoading(id)
        try {
            const { error } = await supabase
                .from('peminjaman')
                .delete()
                .eq('id', id)

            if (error) throw error
            fetchData()
        } catch (err: any) {
            alert('Gagal membatalkan: ' + err.message)
        } finally {
            setActionLoading(null)
        }
    }

    const handlePrint = (loan: Peminjaman) => {
        setPrintLoan(loan)
        setPrintModalOpen(true)
    }

    const handlePrintNow = () => {
        window.print()
    }

    const filteredData = peminjamans.filter(item => {
        const matchesSearch =
            item.kode_peminjaman?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.profiles?.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.peminjaman_detail.some(d => d.sarpras?.nama.toLowerCase().includes(searchTerm.toLowerCase()))

        const matchesStatus = filterStatus === 'SEMUA'
            ? true
            : filterStatus === 'SELESAI'
                ? ['dikembalikan', 'ditolak'].includes(item.status)
                : item.status.toUpperCase() === filterStatus

        return matchesSearch && matchesStatus
    })

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'menunggu': return 'bg-yellow-100 text-yellow-700'
            case 'disetujui': return 'bg-blue-100 text-blue-700'
            case 'dipinjam': return 'bg-purple-100 text-purple-700'
            case 'dikembalikan': return 'bg-green-100 text-green-700'
            case 'ditolak': return 'bg-red-100 text-red-700'
            default: return 'bg-gray-100 text-gray-700'
        }
    }

    if (isLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Data Peminjaman</h1>
                <p className="text-gray-500 mt-2">Kelola semua permohonan peminjaman sarpras.</p>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                        placeholder="Cari kode atau nama peminjam..."
                        className="pl-10 h-10 rounded-full border-gray-200"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex bg-gray-100 p-1 rounded-full">
                    {['SEMUA', 'MENUNGGU', 'DISETUJUI', 'SELESAI'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setFilterStatus(tab)}
                            className={cn(
                                "px-4 py-1.5 rounded-full text-xs font-semibold transition-all",
                                filterStatus === tab
                                    ? "bg-white text-blue-600 shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            <Card className="border-gray-100 shadow-sm overflow-hidden text-sm">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr>
                                <th className="text-left py-4 px-6 font-medium text-gray-500 w-[180px]">Kode / Tgl</th>
                                <th className="text-left py-4 px-6 font-medium text-gray-500">Peminjam</th>
                                <th className="text-left py-4 px-6 font-medium text-gray-500">Barang</th>
                                <th className="text-left py-4 px-6 font-medium text-gray-500">Status</th>
                                <th className="text-right py-4 px-6 font-medium text-gray-500">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-gray-400">
                                        Tidak ada data peminjaman ditemukan
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="py-4 px-6 align-top">
                                            <div className="flex flex-col gap-1">
                                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold w-fit font-mono">
                                                    {item.kode_peminjaman}
                                                </span>
                                                <span className="text-gray-500 text-xs">
                                                    {new Date(item.tanggal_pinjam).toLocaleDateString('id-ID', {
                                                        day: '2-digit', month: 'short', year: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 align-top">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-gray-900">{item.profiles?.nama_lengkap}</span>
                                                <span className="text-gray-400 text-xs">
                                                    {item.profiles?.email || '-'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 align-top">
                                            {item.peminjaman_detail.map((detail, idx) => (
                                                <div key={idx} className="flex flex-col mb-2 last:mb-0">
                                                    <span className="font-medium text-gray-800">{detail.sarpras?.nama}</span>
                                                    <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit mt-0.5">
                                                        {detail.jumlah} Unit
                                                    </span>
                                                </div>
                                            ))}
                                        </td>
                                        <td className="py-4 px-6 align-top">
                                            <span className={cn(
                                                "px-2.5 py-1 rounded-full text-xs font-semibold capitalize",
                                                getStatusColor(item.status)
                                            )}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 align-top text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-40">
                                                    <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => { setSelectedLoan(item); setDetailModalOpen(true); }}>
                                                        <Eye className="mr-2 h-4 w-4 opacity-70" /> Lihat Detail
                                                    </DropdownMenuItem>
                                                    {(item.status === 'disetujui' || item.status === 'dipinjam') && (
                                                        <DropdownMenuItem onClick={() => handlePrint(item)}>
                                                            <FileText className="mr-2 h-4 w-4 opacity-70" /> Cetak Bukti
                                                        </DropdownMenuItem>
                                                    )}
                                                    {item.status === 'menunggu' && (
                                                        <>
                                                            <DropdownMenuItem onClick={() => handleApprove(item.id)} disabled={!!actionLoading}>
                                                                <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Setujui
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => { setSelectedLoan(item); setRejectModalOpen(true); }} disabled={!!actionLoading}>
                                                                <XCircle className="mr-2 h-4 w-4 text-red-600" /> Tolak
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleCancel(item.id)} className="text-red-600 focus:text-red-600" disabled={!!actionLoading}>
                                                                <X className="mr-2 h-4 w-4" /> Batalkan
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Detail Modal */}
            <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Detail Peminjaman</DialogTitle>
                        <DialogDescription>
                            Kode: {selectedLoan?.kode_peminjaman}
                        </DialogDescription>
                    </DialogHeader>
                    {selectedLoan && (
                        <div className="grid grid-cols-2 gap-6 py-4">
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase">Peminjam</h4>
                                    <p className="font-medium">{selectedLoan.profiles?.nama_lengkap}</p>
                                    <p className="text-sm text-gray-500">{selectedLoan.profiles?.email}</p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase">Tanggal Pinjam</h4>
                                    <p className="text-sm">{new Date(selectedLoan.tanggal_pinjam).toLocaleDateString('id-ID', { dateStyle: 'full' })}</p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase">Estimasi Kembali</h4>
                                    <p className="text-sm">{new Date(selectedLoan.tanggal_kembali_estimasi).toLocaleDateString('id-ID', { dateStyle: 'full' })}</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase">Tujuan</h4>
                                    <p className="text-sm bg-gray-50 p-3 rounded-lg border border-gray-100 italic">
                                        "{selectedLoan.tujuan}"
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Barang yang dipinjam</h4>
                                    <div className="space-y-2">
                                        {selectedLoan.peminjaman_detail.map((detail, i) => (
                                            <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                                                <span className="text-sm font-medium">{detail.sarpras?.nama}</span>
                                                <span className="text-xs bg-white border px-2 py-1 rounded shadow-sm">x{detail.jumlah}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setDetailModalOpen(false)}>Tutup</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Modal */}
            <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tolak Permohonan</DialogTitle>
                        <DialogDescription>
                            Berikan alasan mengapa permohonan ini ditolak.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea
                            placeholder="Alasan penolakan..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={4}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectModalOpen(false)}>Batal</Button>
                        <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>Tolak Permohonan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Print Modal */}
            <Dialog open={printModalOpen} onOpenChange={setPrintModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Bukti Peminjaman</DialogTitle>
                        <DialogDescription>
                            Cetak bukti ini dan lampirkan pada barang. QR digunakan saat pengembalian.
                        </DialogDescription>
                    </DialogHeader>
                    {printLoan && (
                        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-6 py-2">
                            <div className="space-y-3">
                                <div className="rounded-xl border bg-white p-4">
                                    <div className="text-xs text-gray-500">Kode Peminjaman</div>
                                    <div className="text-lg font-bold font-mono text-gray-900">{printLoan.kode_peminjaman}</div>
                                </div>
                                <div className="rounded-xl border bg-white p-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Peminjam</span>
                                        <span className="font-medium">{printLoan.profiles?.nama_lengkap}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Tanggal Pinjam</span>
                                        <span className="font-medium">{new Date(printLoan.tanggal_pinjam).toLocaleDateString('id-ID')}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Estimasi Kembali</span>
                                        <span className="font-medium">{new Date(printLoan.tanggal_kembali_estimasi).toLocaleDateString('id-ID')}</span>
                                    </div>
                                </div>
                                <div className="rounded-xl border bg-white p-4">
                                    <div className="text-xs font-semibold text-gray-500 mb-2">Barang Dipinjam</div>
                                    <div className="space-y-2">
                                        {printLoan.peminjaman_detail.map((detail, i) => (
                                            <div key={i} className="flex justify-between text-sm">
                                                <span className="font-medium">{detail.sarpras?.nama}</span>
                                                <span className="text-gray-600">x{detail.jumlah}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center rounded-xl border bg-white p-4">
                                <img
                                    alt="QR Code"
                                    className="h-40 w-40"
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(printLoan.kode_peminjaman || '')}`}
                                />
                                <div className="mt-3 text-xs text-gray-500 text-center">
                                    Scan QR untuk proses pengembalian
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPrintModalOpen(false)}>Tutup</Button>
                        <Button onClick={handlePrintNow}>Cetak</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
