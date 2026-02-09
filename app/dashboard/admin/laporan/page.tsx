'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Activity, ArrowUpRight, ClipboardList, Filter, Search } from 'lucide-react';


interface ActivityLog {
    id: string;
    user_id: string | null;
    action: string;
    module: string;
    description: string;
    ip_address: string | null;
    user_agent: string | null;
    data_before: Record<string, any> | null;
    data_after: Record<string, any> | null;
    created_at: string;
}

interface Profile {
    id: string;
    nama_lengkap: string;
}

export default function ActivityLogPage() {
    const router = useRouter();
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [profiles, setProfiles] = useState<Record<string, Profile>>({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterModule, setFilterModule] = useState('');
    const [filterAction, setFilterAction] = useState('');

    useEffect(() => {
        const checkAuthAndFetch = async () => {
            try {
                const profileId = localStorage.getItem('profileId');
                if (!profileId) {
                    router.push('/login');
                    return;
                }

                const { data: profile, error: roleError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', profileId)
                    .single();

                if (roleError || !profile || profile.role !== 'admin') {
                    router.push('/dashboard');
                    return;
                }

                setLoading(true);

                // Fetch activity logs
                const { data: logs, error: logsError } = await supabase
                    .from('activity_log')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (logsError) throw logsError;

                setActivityLogs(logs || []);

                // Fetch unique user IDs from logs
                const userIds = [...new Set((logs || []).map((log) => log.user_id).filter(Boolean))];

                if (userIds.length > 0) {
                    const { data: profilesData, error: profilesError } = await supabase
                        .from('profiles')
                        .select('id, nama_lengkap')
                        .in('id', userIds);

                    if (profilesError) throw profilesError;

                    const profilesMap: Record<string, Profile> = {};
                    (profilesData || []).forEach((profile) => {
                        profilesMap[profile.id] = profile;
                    });
                    setProfiles(profilesMap);
                }

            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        checkAuthAndFetch();
    }, [router]);

    const filteredLogs = activityLogs.filter((log) => {
        const searchLower = searchQuery.toLowerCase();
        const moduleMatch = !filterModule || log.module.toLowerCase() === filterModule.toLowerCase();
        const actionMatch = !filterAction || log.action.toLowerCase() === filterAction.toLowerCase();
        const descriptionMatch = log.description.toLowerCase().includes(searchLower);

        return moduleMatch && actionMatch && descriptionMatch;
    });

    const modules = [...new Set(activityLogs.map((log) => log.module))].sort();
    const actions = [...new Set(activityLogs.map((log) => log.action))].sort();

    const metrics = useMemo(() => {
        const total = activityLogs.length;
        const createCount = activityLogs.filter((log) => log.action.toLowerCase() === 'create').length;
        const updateCount = activityLogs.filter((log) => log.action.toLowerCase() === 'update').length;
        const deleteCount = activityLogs.filter((log) => log.action.toLowerCase() === 'delete').length;
        const otherCount = Math.max(total - createCount - updateCount - deleteCount, 0);
        return { total, createCount, updateCount, deleteCount, otherCount };
    }, [activityLogs]);

    const donutStops = useMemo(() => {
        const total = metrics.total || 1;
        const createPct = (metrics.createCount / total) * 100;
        const updatePct = (metrics.updateCount / total) * 100;
        const deletePct = (metrics.deleteCount / total) * 100;
        const otherPct = Math.max(100 - createPct - updatePct - deletePct, 0);
        return {
            createPct,
            updatePct,
            deletePct,
            otherPct,
        };
    }, [metrics]);

    const getActionBadgeColor = (action: string) => {
        switch (action.toLowerCase()) {
            case 'create':
                return 'bg-green-100 text-green-800';
            case 'update':
                return 'bg-blue-100 text-blue-800';
            case 'delete':
                return 'bg-red-100 text-red-800';
            case 'view':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getModuleBadgeColor = (module: string) => {
        const colors: Record<string, string> = {
            pengaduan: 'bg-purple-100 text-purple-800',
            sarpras: 'bg-blue-100 text-blue-800',
            lokasi: 'bg-green-100 text-green-800',
            kategori: 'bg-yellow-100 text-yellow-800',
            users: 'bg-indigo-100 text-indigo-800',
            admin: 'bg-pink-100 text-pink-800',
        };
        return colors[module.toLowerCase()] || 'bg-gray-100 text-gray-800';
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        <Activity className="h-3.5 w-3.5" />
                        Real-time Activity
                    </div>
                    <h1 className="mt-3 text-3xl font-bold text-gray-900">Analitik Aktivitas Sistem</h1>
                    <p className="text-gray-600 mt-2 max-w-2xl">
                        Pantau pola aktivitas admin dan pergerakan data utama. Filter dan cari riwayat tindakan untuk audit cepat.
                    </p>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white px-4 py-3 text-sm text-blue-700 shadow-sm">
                    <ArrowUpRight className="h-4 w-4" />
                    Data diperbarui otomatis
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Card className="p-5 border border-blue-100 bg-gradient-to-br from-blue-50 to-white">
                    <div className="text-xs font-semibold text-blue-700">Total Aktivitas</div>
                    <div className="mt-3 text-3xl font-bold text-blue-900">{metrics.total}</div>
                    <div className="mt-2 text-xs text-blue-600">Semua aksi yang tercatat</div>
                </Card>
                <Card className="p-5 border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
                    <div className="text-xs font-semibold text-emerald-700">Create</div>
                    <div className="mt-3 text-3xl font-bold text-emerald-700">{metrics.createCount}</div>
                    <div className="mt-2 text-xs text-emerald-600">Penambahan data baru</div>
                </Card>
                <Card className="p-5 border border-sky-100 bg-gradient-to-br from-sky-50 to-white">
                    <div className="text-xs font-semibold text-sky-700">Update</div>
                    <div className="mt-3 text-3xl font-bold text-sky-700">{metrics.updateCount}</div>
                    <div className="mt-2 text-xs text-sky-600">Perubahan data</div>
                </Card>
                <Card className="p-5 border border-rose-100 bg-gradient-to-br from-rose-50 to-white">
                    <div className="text-xs font-semibold text-rose-700">Delete</div>
                    <div className="mt-3 text-3xl font-bold text-rose-700">{metrics.deleteCount}</div>
                    <div className="mt-2 text-xs text-rose-600">Penghapusan data</div>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
                <Card className="p-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">Distribusi Aktivitas</h3>
                            <p className="text-xs text-gray-500 mt-1">Komposisi aksi utama saat ini.</p>
                        </div>
                        <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">Ringkasan</div>
                    </div>
                    <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div
                            className="relative h-44 w-44 rounded-full"
                            style={{
                                background: `conic-gradient(#10b981 0% ${donutStops.createPct}%,
                                    #0ea5e9 ${donutStops.createPct}% ${donutStops.createPct + donutStops.updatePct}%,
                                    #f43f5e ${donutStops.createPct + donutStops.updatePct}% ${donutStops.createPct + donutStops.updatePct + donutStops.deletePct}%,
                                    #e5e7eb ${donutStops.createPct + donutStops.updatePct + donutStops.deletePct}% 100%)`,
                            }}
                        >
                            <div className="absolute inset-5 rounded-full bg-white shadow-sm"></div>
                            <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-gray-700">
                                {metrics.total} Log
                            </div>
                        </div>
                        <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-emerald-500"></span>
                                Create ({metrics.createCount})
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-sky-500"></span>
                                Update ({metrics.updateCount})
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-rose-500"></span>
                                Delete ({metrics.deleteCount})
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-gray-300"></span>
                                Lainnya ({metrics.otherCount})
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">Filter Aktivitas</h3>
                            <p className="text-xs text-gray-500 mt-1">Cari log berdasarkan deskripsi, module, atau action.</p>
                        </div>
                        <Filter className="h-4 w-4 text-gray-400" />
                    </div>

                    <div className="mt-5 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <Input
                                placeholder="Cari deskripsi aktivitas..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-2">Filter Module</label>
                                <select
                                    value={filterModule}
                                    onChange={(e) => setFilterModule(e.target.value)}
                                    className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-900"
                                >
                                    <option value="">Semua Module</option>
                                    {modules.map((module) => (
                                        <option key={module} value={module}>
                                            {module}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-2">Filter Action</label>
                                <select
                                    value={filterAction}
                                    onChange={(e) => setFilterAction(e.target.value)}
                                    className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-900"
                                >
                                    <option value="">Semua Action</option>
                                    {actions.map((action) => (
                                        <option key={action} value={action}>
                                            {action}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            <Card className="overflow-hidden border border-gray-100">
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <ClipboardList className="h-4 w-4 text-gray-500" />
                        Riwayat Aktivitas Terbaru
                    </div>
                    <div className="text-xs text-gray-500">
                        Menampilkan {filteredLogs.length} dari {activityLogs.length} log
                    </div>
                </div>
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-6 text-center text-gray-600">Loading activity logs...</div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="p-6 text-center text-gray-600">Tidak ada activity logs ditemukan</div>
                    ) : (
                        <table className="w-full">
                            <thead className="border-b border-gray-100 bg-white">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Waktu
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        User
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Module
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Action
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Deskripsi
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        IP Address
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            {log.user_id ? profiles[log.user_id]?.nama_lengkap || 'Unknown' : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getModuleBadgeColor(log.module)}`}>
                                                {log.module}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getActionBadgeColor(log.action)}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">{log.description}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 text-xs">{log.ip_address || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </Card>
        </div>
    );
}
