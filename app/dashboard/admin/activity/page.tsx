'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Activity, Filter, LogIn, RefreshCcw, ClipboardCheck, FileWarning, Search } from 'lucide-react';

interface ActivityLog {
    id: string;
    user_id: string | null;
    action: string;
    module: string;
    description: string;
    ip_address: string | null;
    user_agent: string | null;
    client_app: string | null;
    data_before: Record<string, any> | null;
    data_after: Record<string, any> | null;
    created_at: string;
}

interface Profile {
    id: string;
    nama_lengkap: string;
}

const MAIN_ACTIONS = ['login', 'peminjaman', 'pengembalian', 'pengaduan'];

export default function ActivityLogPage() {
    const router = useRouter();
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [profiles, setProfiles] = useState<Record<string, Profile>>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterModule, setFilterModule] = useState('');
    const [quickFilter, setQuickFilter] = useState<string>('all');

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

                const fetchLogs = async () => {
                    const { data: logs, error: logsError } = await supabase
                        .from('activity_log')
                        .select('*')
                        .order('created_at', { ascending: false });

                    if (logsError) throw logsError;

                    const safeLogs = logs || [];
                    setActivityLogs(safeLogs);

                    const userIds = [...new Set(safeLogs.map((log) => log.user_id).filter(Boolean))];
                    if (userIds.length > 0) {
                        const { data: profilesData, error: profilesError } = await supabase
                            .from('profiles')
                            .select('id, nama_lengkap')
                            .in('id', userIds);

                        if (profilesError) throw profilesError;

                        const profilesMap: Record<string, Profile> = {};
                        (profilesData || []).forEach((p) => {
                            profilesMap[p.id] = p;
                        });
                        setProfiles(profilesMap);
                    }
                };

                setLoading(true);
                await fetchLogs();
                setRefreshing(false);
            } catch (error) {
                console.error('Error fetching data:', error);
                setRefreshing(false);
            } finally {
                setLoading(false);
            }
        };

        checkAuthAndFetch();

        const channel = supabase
            .channel('activity-log-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'activity_log' },
                (payload) => {
                    if (payload.eventType === 'INSERT' && payload.new) {
                        const incoming = payload.new as ActivityLog;
                        setActivityLogs((prev) => [incoming, ...prev]);
                        if (incoming.user_id && !profiles[incoming.user_id]) {
                            supabase
                                .from('profiles')
                                .select('id, nama_lengkap')
                                .eq('id', incoming.user_id)
                                .single()
                                .then(({ data }) => {
                                    if (data) {
                                        setProfiles((prev) => ({ ...prev, [data.id]: data }));
                                    }
                                });
                        }
                    }
                    if (payload.eventType === 'UPDATE' && payload.new) {
                        setActivityLogs((prev) =>
                            prev.map((item) => (item.id === (payload.new as ActivityLog).id ? (payload.new as ActivityLog) : item))
                        );
                    }
                    if (payload.eventType === 'DELETE' && payload.old) {
                        setActivityLogs((prev) => prev.filter((item) => item.id !== (payload.old as ActivityLog).id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [router]);

    const isMainAction = (value?: string | null) => {
        if (!value) return false;
        return MAIN_ACTIONS.includes(value.toLowerCase());
    };

    const resolveActionLabel = (log: ActivityLog) => {
        if (isMainAction(log.module)) return log.module.toLowerCase();
        if (isMainAction(log.action)) return log.action.toLowerCase();
        return log.action.toLowerCase();
    };

    const modules = useMemo(() => {
        return [...new Set(activityLogs.map((log) => log.module))]
            .filter((module) => isMainAction(module))
            .sort();
    }, [activityLogs]);

    const filteredLogs = useMemo(() => {
        const searchLower = searchQuery.toLowerCase();

        return activityLogs.filter((log) => {
            const resolvedAction = resolveActionLabel(log);
            const inMainActions = isMainAction(log.module) || isMainAction(log.action);
            if (!inMainActions) return false;

            const moduleMatch = !filterModule || log.module.toLowerCase() === filterModule.toLowerCase();
            const quickMatch =
                quickFilter === 'all' ||
                resolvedAction === quickFilter;
            const descriptionMatch =
                log.description.toLowerCase().includes(searchLower) ||
                resolvedAction.includes(searchLower) ||
                log.module.toLowerCase().includes(searchLower);

            return moduleMatch && quickMatch && descriptionMatch;
        });
    }, [activityLogs, filterModule, quickFilter, searchQuery]);

    const quickStats = useMemo(() => {
        const countByKey: Record<string, number> = {
            login: 0,
            peminjaman: 0,
            pengembalian: 0,
            pengaduan: 0,
        };

        activityLogs.forEach((log) => {
            const key = log.module?.toLowerCase();
            const actionKey = log.action?.toLowerCase();
            if (countByKey[key] !== undefined) countByKey[key] += 1;
            else if (countByKey[actionKey] !== undefined) countByKey[actionKey] += 1;
        });

        return countByKey;
    }, [activityLogs]);

    const getModuleBadgeColor = (module: string) => {
        const colors: Record<string, string> = {
            pengaduan: 'bg-purple-100 text-purple-800',
            peminjaman: 'bg-blue-100 text-blue-800',
            pengembalian: 'bg-emerald-100 text-emerald-800',
            login: 'bg-slate-100 text-slate-800',
            sarpras: 'bg-indigo-100 text-indigo-800',
            lokasi: 'bg-green-100 text-green-800',
            kategori: 'bg-yellow-100 text-yellow-800',
            users: 'bg-pink-100 text-pink-800',
        };
        return colors[module.toLowerCase()] || 'bg-gray-100 text-gray-800';
    };

    const getActionBadgeColor = (action: string) => {
        switch (action.toLowerCase()) {
            case 'login':
                return 'bg-slate-100 text-slate-800';
            case 'peminjaman':
                return 'bg-blue-100 text-blue-800';
            case 'pengembalian':
                return 'bg-emerald-100 text-emerald-800';
            case 'pengaduan':
                return 'bg-purple-100 text-purple-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        setLoading(true);
        try {
            const { data: logs, error: logsError } = await supabase
                .from('activity_log')
                .select('*')
                .order('created_at', { ascending: false });

            if (logsError) throw logsError;

            const safeLogs = logs || [];
            setActivityLogs(safeLogs);

            const userIds = [...new Set(safeLogs.map((log) => log.user_id).filter(Boolean))];
            if (userIds.length > 0) {
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id, nama_lengkap')
                    .in('id', userIds);

                const profilesMap: Record<string, Profile> = {};
                (profilesData || []).forEach((p) => {
                    profilesMap[p.id] = p;
                });
                setProfiles(profilesMap);
            }
        } catch (error) {
            console.error('Error refreshing data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        <Activity className="h-3.5 w-3.5" />
                        Activity Log
                    </div>
                    <h1 className="mt-3 text-3xl font-bold text-gray-900">Log Aktivitas Admin</h1>
                    <p className="text-gray-600 mt-2 max-w-2xl">
                        Setiap aksi penting (login, peminjaman, pengembalian, pengaduan) tercatat lengkap dengan waktu dan user.
                    </p>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white px-4 py-3 text-sm text-blue-700 shadow-sm">
                    <RefreshCcw className="h-4 w-4" />
                    Data real-time
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="ml-2 inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                    >
                        {refreshing ? 'Memuat...' : 'Refresh'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Card className="p-5 border border-slate-100 bg-gradient-to-br from-slate-50 to-white">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                        <LogIn className="h-4 w-4" /> Login
                    </div>
                    <div className="mt-3 text-3xl font-bold text-slate-800">{quickStats.login}</div>
                </Card>
                <Card className="p-5 border border-blue-100 bg-gradient-to-br from-blue-50 to-white">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                        <ClipboardCheck className="h-4 w-4" /> Peminjaman
                    </div>
                    <div className="mt-3 text-3xl font-bold text-blue-700">{quickStats.peminjaman}</div>
                </Card>
                <Card className="p-5 border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
                        <RefreshCcw className="h-4 w-4" /> Pengembalian
                    </div>
                    <div className="mt-3 text-3xl font-bold text-emerald-700">{quickStats.pengembalian}</div>
                </Card>
                <Card className="p-5 border border-purple-100 bg-gradient-to-br from-purple-50 to-white">
                    <div className="flex items-center gap-2 text-xs font-semibold text-purple-600">
                        <FileWarning className="h-4 w-4" /> Pengaduan
                    </div>
                    <div className="mt-3 text-3xl font-bold text-purple-700">{quickStats.pengaduan}</div>
                </Card>
            </div>

            <Card className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <Filter className="h-4 w-4 text-gray-500" />
                        Filter Aktivitas
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                quickFilter === 'all' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600'
                            }`}
                            onClick={() => setQuickFilter('all')}
                        >
                            Semua
                        </button>
                        {MAIN_ACTIONS.map((item) => (
                            <button
                                key={item}
                                className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
                                    quickFilter === item ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600'
                                }`}
                                onClick={() => setQuickFilter(item)}
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            placeholder="Cari berdasarkan aksi, module, atau deskripsi..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9"
                        />
                    </div>
                    <div>
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
                </div>
            </Card>

            <Card className="overflow-hidden border border-gray-100">
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
                    <div className="text-sm font-semibold text-gray-700">Riwayat Aktivitas</div>
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
                                        Aksi
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Module
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Deskripsi
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        IP
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        App
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
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getActionBadgeColor(resolveActionLabel(log))}`}>
                                                {resolveActionLabel(log)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getModuleBadgeColor(log.module)}`}>
                                                {log.module}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">{log.description}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700">{log.ip_address || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700">{log.client_app || '-'}</td>
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
