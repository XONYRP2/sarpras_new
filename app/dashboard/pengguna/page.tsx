
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, BadgeCheck, Calendar, CirclePlus, Package, User, ClipboardList } from "lucide-react"

export default function PenggunaDashboard() {
    const stats = [
        {
            title: "Aset Tersedia",
            value: "100%",
            desc: "Persentase stok barang siap pinjam",
            icon: <Package className="h-4 w-4 text-emerald-700" />,
            accent: "from-emerald-100 to-emerald-50",
        },
        {
            title: "Peminjaman Baru",
            value: "1",
            desc: "Pengajuan menunggu persetujuan",
            icon: <ClipboardList className="h-4 w-4 text-amber-700" />,
            accent: "from-amber-100 to-amber-50",
        },
        {
            title: "Pengaduan Aktif",
            value: "0",
            desc: "Laporan kerusakan belum selesai",
            icon: <Activity className="h-4 w-4 text-rose-700" />,
            accent: "from-rose-100 to-rose-50",
        },
        {
            title: "Total Pengguna",
            value: "6",
            desc: "Anggota terdaftar di sistem",
            icon: <User className="h-4 w-4 text-sky-700" />,
            accent: "from-sky-100 to-sky-50",
        },
    ]

    const activities = [
        {
            name: "Kursi Siswa",
            meta: "Pengguna Satu • 08 Feb",
            status: "Menunggu",
            statusTone: "bg-amber-100 text-amber-800",
        },
        {
            name: "Proyektor",
            meta: "Pengguna Satu • 08 Feb",
            status: "Dikembalikan",
            statusTone: "bg-emerald-100 text-emerald-800",
        },
    ]

    return (
        <div className="space-y-6">
            <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.95),_rgba(2,6,23,0.98))] p-6 text-white shadow-[0_18px_50px_rgba(15,23,42,0.22)]">
                <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(148,163,184,0.3)_1px,transparent_1px)] [background-size:18px_18px]" />
                <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-cyan-400/40 to-indigo-500/30 blur-2xl" />
                <div className="absolute -left-8 bottom-0 h-36 w-36 rounded-full bg-gradient-to-br from-emerald-400/35 to-teal-500/30 blur-2xl" />
                <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Halo, Pengguna!</p>
                        <h1 className="text-2xl font-bold text-white md:text-3xl">Selamat datang di panel kontrol SARPRAS</h1>
                        <p className="mt-1 text-sm text-white/70">Berikut ringkasan aktivitas dan akses cepat hari ini.</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/80 shadow-sm">
                        <Calendar className="h-3.5 w-3.5 text-white/70" />
                        Senin, 09 Februari 2026
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {stats.map((item) => (
                    <div
                        key={item.title}
                        className={`rounded-2xl border bg-gradient-to-br ${item.accent} p-4 shadow-sm`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="rounded-2xl bg-white/80 p-2">{item.icon}</span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Live</span>
                        </div>
                        <div className="mt-4 text-2xl font-bold text-slate-900">{item.value}</div>
                        <div className="text-sm font-semibold text-slate-700">{item.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{item.desc}</div>
                    </div>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <Card className="rounded-2xl border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <div>
                            <CardTitle className="text-base">Aktivitas Peminjaman</CardTitle>
                            <p className="text-xs text-muted-foreground">Daftar transaksi peminjaman terbaru.</p>
                        </div>
                        <button className="text-xs font-semibold text-slate-600 hover:text-slate-900">Semua</button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {activities.map((item) => (
                            <div
                                key={item.name}
                                className="flex items-center justify-between rounded-xl border bg-white px-4 py-3"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-700">
                                        {item.name[0]}
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                                        <div className="text-xs text-slate-500">{item.meta}</div>
                                    </div>
                                </div>
                                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.statusTone}`}>
                                    {item.status}
                                </span>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base">Akses Cepat</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <button className="flex w-full items-center justify-between rounded-2xl border bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50">
                                <span className="flex items-center gap-3">
                                    <span className="rounded-xl bg-slate-100 p-2 text-slate-600">
                                        <Package className="h-4 w-4" />
                                    </span>
                                    Pinjam Barang
                                </span>
                                <CirclePlus className="h-4 w-4 text-slate-500" />
                            </button>
                            <button className="flex w-full items-center justify-between rounded-2xl border bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50">
                                <span className="flex items-center gap-3">
                                    <span className="rounded-xl bg-slate-100 p-2 text-slate-600">
                                        <Activity className="h-4 w-4" />
                                    </span>
                                    Buat Pengaduan
                                </span>
                                <CirclePlus className="h-4 w-4 text-slate-500" />
                            </button>
                        </CardContent>
                    </Card>

                    <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 p-5 text-white shadow-sm">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <BadgeCheck className="h-4 w-4 text-white/80" />
                            Butuh Bantuan?
                        </div>
                        <p className="mt-2 text-xs text-white/80">
                            Jika mengalami kendala sistem, hubungi administrator IT sekolah.
                        </p>
                        <button className="mt-4 w-full rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100">
                            Hubungi Admin
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
