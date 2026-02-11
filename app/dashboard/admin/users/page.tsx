
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Edit, Search, Key, Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { logActivity } from '@/lib/activity'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

// Schema based types
interface User {
    id: string
    username: string
    nama_lengkap: string
    role: string
    email: string | null
    is_active?: boolean
    created_at: string
}

export default function UsersPage() {
    const router = useRouter()
    const [users, setUsers] = useState<User[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [userRole, setUserRole] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showInactive, setShowInactive] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)
    const [passwordModalOpen, setPasswordModalOpen] = useState(false)
    const [passwordTarget, setPasswordTarget] = useState<User | null>(null)
    const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
    const [isResettingPassword, setIsResettingPassword] = useState(false)
    const [showOldPassword, setShowOldPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    // Form state
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        nama_lengkap: '',
        role: 'pengguna',
        email: '',
    })

    useEffect(() => {
        const checkAuthAndFetch = async () => {
            try {
                // Check if user is logged in using profileId (new standard)
                const profileId = localStorage.getItem('profileId')
                if (!profileId) {
                    router.push('/login')
                    return
                }

                // Verify role from DB
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

                // Fetch users from profiles table 
                // Creating a new user adds to profiles and user_credentials via function
                // Reading from profiles is sufficient for listing
                const baseQuery = supabase
                    .from('profiles')
                    .select('*')

                const { data, error } = showInactive
                    ? await baseQuery.order('created_at', { ascending: false })
                    : await baseQuery.eq('is_active', true).order('created_at', { ascending: false })

                if (error) throw error

                if (data) {
                    setUsers(data)
                }

            } catch (err) {
                console.error('Error:', err)
            } finally {
                setIsLoading(false)
            }
        }

        checkAuthAndFetch()
    }, [router, showInactive])

    const filteredUsers = users.filter((user) => {
        const searchLower = searchTerm.toLowerCase()
        return (
            user.username.toLowerCase().includes(searchLower) ||
            (user.nama_lengkap && user.nama_lengkap.toLowerCase().includes(searchLower)) ||
            user.role.toLowerCase().includes(searchLower)
        )
    })

    const handleDeleteUser = async (userId: string) => {
        if (!window.confirm('Apakah Anda yakin ingin menghapus pengguna ini?')) {
            return
        }

        try {
            // Deleting from profiles will cascade delete credentials as per schema
            const { data, error } = await supabase
                .from('profiles')
                .update({ is_active: false })
                .eq('id', userId)
                .select('id')

            if (error) throw error
            if (!data || data.length === 0) {
                alert('Gagal menghapus user: tidak ada baris terupdate (cek policy RLS)')
                return
            }

            setUsers(users.filter((u) => u.id !== userId))
            await logActivity({
                userId: localStorage.getItem('profileId'),
                action: 'update',
                module: 'users',
                description: `Menonaktifkan user ${userId}`,
                dataAfter: { user_id: userId, is_active: false },
            })
            alert('User berhasil dinonaktifkan')
        } catch (err) {
            console.error('Error deleting user:', err)
            // Fix: properly type error
            alert('Gagal menonaktifkan pengguna: ' + (err as Error).message)
        }
    }

    const handleAddUser = async () => {
        if (!formData.username || !formData.password || !formData.nama_lengkap) {
            alert('Mohon lengkapi data wajib (Username, Password, Nama Lengkap)')
            return
        }

        setIsSubmitting(true)

        try {
            // Call the PostgreSQL function defined in schema
            const { data, error } = await supabase
                .rpc('create_user_with_username', {
                    p_username: formData.username,
                    p_password: formData.password,
                    p_nama_lengkap: formData.nama_lengkap,
                    p_role: formData.role,
                    p_email: formData.email || null
                })

            if (error) throw error

            if (data && data.success) {
                await logActivity({
                    userId: localStorage.getItem('profileId'),
                    action: 'create',
                    module: 'users',
                    description: `Menambahkan user ${formData.username}`,
                    dataAfter: { username: formData.username, role: formData.role },
                })
                alert('User berhasil ditambahkan')
                setIsModalOpen(false)

                // Refresh list
                const { data: newUsers } = await supabase
                    .from('profiles')
                    .select('*')
                    .order('created_at', { ascending: false })

                if (newUsers) setUsers(newUsers)

                // Reset form
                setFormData({
                    username: '',
                    password: '',
                    nama_lengkap: '',
                    role: 'pengguna',
                    email: '',
                })
            } else {
                alert('Gagal: ' + (data?.error || 'Unknown error'))
            }

        } catch (err) {
            console.error('Error adding user:', err)
            alert('Terjadi kesalahan: ' + (err as Error).message)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleEditClick = (user: User) => {
        setEditingUser(user)
        setFormData({
            username: user.username,
            password: '',
            nama_lengkap: user.nama_lengkap || '',
            role: user.role || 'pengguna',
            email: user.email || '',
        })
        setIsModalOpen(true)
    }

    const handleUpdateUser = async () => {
        if (!editingUser) return
        if (!formData.nama_lengkap) {
            alert('Nama Lengkap wajib diisi')
            return
        }

        setIsSubmitting(true)

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    nama_lengkap: formData.nama_lengkap,
                    email: formData.email || null,
                    role: formData.role,
                })
                .eq('id', editingUser.id)

            if (error) throw error

            setUsers(users.map((u) => (
                u.id === editingUser.id
                    ? {
                        ...u,
                        nama_lengkap: formData.nama_lengkap,
                        email: formData.email || null,
                        role: formData.role,
                    }
                    : u
            )))
            await logActivity({
                userId: localStorage.getItem('profileId'),
                action: 'update',
                module: 'users',
                description: `Memperbarui user ${editingUser.username}`,
                dataAfter: { user_id: editingUser.id, role: formData.role },
            })
            alert('User berhasil diperbarui')
            setIsModalOpen(false)
            setEditingUser(null)
            setFormData({
                username: '',
                password: '',
                nama_lengkap: '',
                role: 'pengguna',
                email: '',
            })
        } catch (err) {
            console.error('Error updating user:', err)
            alert('Gagal memperbarui pengguna: ' + (err as Error).message)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleRestoreUser = async (userId: string) => {
        if (!window.confirm('Pulihkan user ini agar aktif kembali?')) {
            return
        }

        try {
            const { data, error } = await supabase
                .from('profiles')
                .update({ is_active: true })
                .eq('id', userId)
                .select('id')

            if (error) throw error
            if (!data || data.length === 0) {
                alert('Gagal memulihkan user: tidak ada baris terupdate (cek policy RLS)')
                return
            }

            if (!showInactive) {
                setUsers((prev) => prev.filter((u) => u.id !== userId))
            } else {
                setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: true } : u)))
            }

            await logActivity({
                userId: localStorage.getItem('profileId'),
                action: 'update',
                module: 'users',
                description: `Memulihkan user ${userId}`,
                dataAfter: { user_id: userId, is_active: true },
            })
            alert('User berhasil dipulihkan')
        } catch (err) {
            console.error('Error restoring user:', err)
            alert('Gagal memulihkan pengguna: ' + (err as Error).message)
        }
    }

    const handleOpenResetPassword = (user: User) => {
        setPasswordTarget(user)
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
        setPasswordModalOpen(true)
    }

    const handleResetPassword = async () => {
        if (!passwordTarget) return
        if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
            alert('Mohon isi password baru dan konfirmasi')
            return
        }
        if (passwordForm.newPassword.length < 6) {
            alert('Password baru minimal 6 karakter')
            return
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            alert('Konfirmasi password tidak cocok')
            return
        }

        setIsResettingPassword(true)
        try {
            const adminId = localStorage.getItem('profileId')
            if (!adminId) {
                alert('User tidak ditemukan, silakan login ulang')
                return
            }

            const { data, error } = await supabase.rpc('admin_reset_user_password', {
                p_admin_id: adminId,
                p_profile_id: passwordTarget.id,
                p_new_password: passwordForm.newPassword,
            })

            if (error) throw error

            if (data && data.success === false) {
                alert('Gagal: ' + (data.error || 'Tidak bisa reset password'))
                return
            }

            alert(`Password untuk ${passwordTarget.username} berhasil direset`)
            setPasswordModalOpen(false)
            setPasswordTarget(null)
            setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
        } catch (err) {
            console.error('Error resetting password:', err)
            alert('Gagal reset password: ' + (err as Error).message)
        } finally {
            setIsResettingPassword(false)
        }
    }

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Loading users...</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Manajemen User</h1>
                    <p className="text-gray-600 mt-2">Kelola akun pengguna, petugas, dan admin</p>
                </div>
                <Button
                    className="bg-gray-900 hover:bg-gray-800"
                    onClick={() => {
                        setEditingUser(null)
                        setFormData({
                            username: '',
                            password: '',
                            nama_lengkap: '',
                            role: 'pengguna',
                            email: '',
                        })
                        setIsModalOpen(true)
                    }}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah User
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Daftar Pengguna</CardTitle>
                    <CardDescription>Total {users.length} pengguna terdaftar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="relative w-full md:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                                placeholder="Cari user..."
                                className="pl-9"
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

                    <div className="rounded-md border">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="p-4 font-medium text-gray-500">Nama Lengkap</th>
                                    <th className="p-4 font-medium text-gray-500">Username</th>
                                    <th className="p-4 font-medium text-gray-500">Role</th>
                                    <th className="p-4 font-medium text-gray-500">Terdaftar</th>
                                    <th className="p-4 font-medium text-gray-500 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-4 text-center text-gray-500">
                                            Tidak ada user ditemukan.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-50/50">
                                            <td className="p-4 font-medium">
                                                <div className="flex items-center gap-2">
                                                    <span>{user.nama_lengkap}</span>
                                                    {user.is_active === false && (
                                                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                                                            Nonaktif
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-muted-foreground">{user.email}</div>
                                            </td>
                                            <td className="p-4 text-gray-600">{user.username}</td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize
                                                    ${user.role === 'admin' ? 'bg-red-100 text-red-800' :
                                                        user.role === 'petugas' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-green-100 text-green-800'}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="p-4 text-gray-500">
                                                {new Date(user.created_at).toLocaleDateString('id-ID', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                                        onClick={() => handleEditClick(user)}
                                                        disabled={user.is_active === false}
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                                                        onClick={() => handleOpenResetPassword(user)}
                                                        disabled={user.is_active === false}
                                                        title="Reset Password"
                                                    >
                                                        <Key className="w-4 h-4" />
                                                    </Button>
                                                    {user.is_active === false ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                            onClick={() => handleRestoreUser(user.id)}
                                                        >
                                                            Pulihkan
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => handleDeleteUser(user.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
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
                </CardContent>
            </Card>

            {/* Modal for Adding/Editing User */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">{editingUser ? 'Edit User' : 'Tambah User Baru'}</h2>
                            <button
                                onClick={() => {
                                    setIsModalOpen(false)
                                    setEditingUser(null)
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Username</label>
                                <Input
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    placeholder="johndoe"
                                    disabled={!!editingUser}
                                />
                            </div>

                            {!editingUser && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Password</label>
                                    <Input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="******"
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nama Lengkap</label>
                                <Input
                                    value={formData.nama_lengkap}
                                    onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
                                    placeholder="John Doe"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Email (Opsional)</label>
                                <Input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="john@example.com"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Role</label>
                                <select
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="pengguna">Pengguna</option>
                                    <option value="petugas">Petugas</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        setIsModalOpen(false)
                                        setEditingUser(null)
                                    }}
                                >
                                    Batal
                                </Button>
                                <Button
                                    className="flex-1"
                                    disabled={isSubmitting}
                                    onClick={editingUser ? handleUpdateUser : handleAddUser}
                                >
                                    {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for Resetting Password */}
            {passwordModalOpen && passwordTarget && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">Reset Password</h2>
                            <button
                                onClick={() => {
                                    setPasswordModalOpen(false)
                                    setPasswordTarget(null)
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="space-y-2 mb-4">
                            <p className="text-sm text-gray-600">User: <span className="font-medium">{passwordTarget.username}</span></p>
                            <p className="text-xs text-gray-500">Masukkan password baru untuk user ini.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Password Lama (Opsional)</label>
                                <div className="relative">
                                    <Input
                                        type={showOldPassword ? 'text' : 'password'}
                                        value={passwordForm.oldPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                                        placeholder="Masukkan password lama jika diketahui"
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowOldPassword((prev) => !prev)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 hover:text-gray-700"
                                        aria-label={showOldPassword ? 'Sembunyikan password lama' : 'Tampilkan password lama'}
                                    >
                                        {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Password Baru</label>
                                <div className="relative">
                                    <Input
                                        type={showNewPassword ? 'text' : 'password'}
                                        value={passwordForm.newPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                        placeholder="Minimal 6 karakter"
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword((prev) => !prev)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 hover:text-gray-700"
                                        aria-label={showNewPassword ? 'Sembunyikan password baru' : 'Tampilkan password baru'}
                                    >
                                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Konfirmasi Password Baru</label>
                                <div className="relative">
                                    <Input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={passwordForm.confirmPassword}
                                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                        placeholder="Ulangi password baru"
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 hover:text-gray-700"
                                        aria-label={showConfirmPassword ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'}
                                    >
                                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        setPasswordModalOpen(false)
                                        setPasswordTarget(null)
                                    }}
                                >
                                    Batal
                                </Button>
                                <Button
                                    className="flex-1"
                                    disabled={isResettingPassword}
                                    onClick={handleResetPassword}
                                >
                                    {isResettingPassword ? 'Menyimpan...' : 'Simpan'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
