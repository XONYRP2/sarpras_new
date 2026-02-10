'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { uploadImage } from '@/lib/storage'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LogOut, User, Shield, Key } from 'lucide-react'

interface Profile {
    id: string
    username: string
    nama_lengkap: string
    role: string
    email: string | null
    foto_profil?: string | null
    created_at: string
}

export default function ProfilePage() {
    const router = useRouter()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [passwords, setPasswords] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    })
    const [isChangingPassword, setIsChangingPassword] = useState(false)
    const [fotoFile, setFotoFile] = useState<File | null>(null)
    const [fotoPreview, setFotoPreview] = useState<string | null>(null)
    const [hideFotoPreview, setHideFotoPreview] = useState(false)
    const [isUploadingFoto, setIsUploadingFoto] = useState(false)

    useEffect(() => {
        const fetchProfile = async () => {
            const profileId = localStorage.getItem('profileId')
            if (!profileId) {
                router.push('/login')
                return
            }

            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', profileId)
                    .single()

                if (error) throw error
                setProfile(data)
                setFotoPreview(data?.foto_profil || null)
            } catch (err) {
                console.error('Error fetching profile:', err)
            } finally {
                setIsLoading(false)
            }
        }

        fetchProfile()
    }, [router])

    const handleLogout = () => {
        localStorage.removeItem('profileId')
        localStorage.removeItem('user')
        router.push('/login')
    }

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (passwords.newPassword !== passwords.confirmPassword) {
            alert('Password baru dan konfirmasi tidak cocok')
            return
        }
        if (passwords.newPassword.length < 6) {
            alert('Password baru minimal 6 karakter')
            return
        }

        setIsChangingPassword(true)

        try {
            const profileId = localStorage.getItem('profileId')

            // Call the RPC function to change password
            // Assumption: User needs to create this function in Supabase
            const { data, error } = await supabase.rpc('change_own_password', {
                p_profile_id: profileId,
                p_old_password: passwords.oldPassword,
                p_new_password: passwords.newPassword
            })

            if (error) throw error

            if (data && !data.success) {
                alert('Gagal: ' + (data.error || 'Password lama salah'))
            } else {
                alert('Password berhasil diubah')
                setPasswords({ oldPassword: '', newPassword: '', confirmPassword: '' })
            }

        } catch (err) {
            console.error('Error changing password:', err)
            // Fallback message if RPC doesn't exist
            if ((err as any).message?.includes('function') && (err as any).message?.includes('does not exist')) {
                alert('Fungsi ubah password belum dikonfigurasi di database. Hubungi administrator.')
            } else {
                alert('Gagal mengubah password: ' + (err as any).message)
            }
        } finally {
            setIsChangingPassword(false)
        }
    }

    const handleUploadFoto = async () => {
        if (!profile) return
        if (!fotoFile) {
            alert('Pilih foto terlebih dahulu')
            return
        }

        setIsUploadingFoto(true)
        try {
            const ext = fotoFile.name.split('.').pop() || 'jpg'
            const fileName = `profiles/${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
            const fotoUrl = await uploadImage({
                bucket: 'SARPRAS',
                path: fileName,
                file: fotoFile,
            })

            const { error } = await supabase
                .from('profiles')
                .update({ foto_profil: fotoUrl })
                .eq('id', profile.id)

            if (error) throw error

            setProfile({ ...profile, foto_profil: fotoUrl })
            setFotoPreview(fotoUrl)
            setHideFotoPreview(false)
            setFotoFile(null)
            alert('Foto profil berhasil diperbarui')
        } catch (err) {
            console.error('Error uploading foto profil:', err)
            alert('Gagal mengunggah foto profil')
        } finally {
            setIsUploadingFoto(false)
        }
    }

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Loading profile...</div>
    }

    if (!profile) {
        return <div className="p-8 text-center text-red-500">Profile not found</div>
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto py-8">
            <h1 className="text-3xl font-bold text-gray-900">Profil Saya</h1>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Profile Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="w-5 h-5" />
                            Informasi Akun
                        </CardTitle>
                        <CardDescription>Detail akun anda saat ini</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="h-20 w-20 rounded-full border bg-gray-50 overflow-hidden flex items-center justify-center">
                                {fotoPreview && !hideFotoPreview ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={fotoPreview} alt="Foto profil" className="h-full w-full object-cover" />
                                ) : (
                                    <User className="w-8 h-8 text-gray-400" />
                                )}
                            </div>
                            <div className="flex-1 space-y-2">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setFotoFile(e.target.files?.[0] || null)}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
                                />
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleUploadFoto}
                                        disabled={isUploadingFoto || !fotoFile}
                                    >
                                        {isUploadingFoto ? 'Mengunggah...' : 'Simpan Foto'}
                                    </Button>
                                    {fotoPreview && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setHideFotoPreview(true)}
                                        >
                                            Hapus dari tampilan
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Nama Lengkap</Label>
                            <p className="font-medium text-lg">{profile.nama_lengkap}</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Username</Label>
                            <p className="font-medium text-gray-700">{profile.username}</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Email</Label>
                            <p className="font-medium text-gray-700">{profile.email || '-'}</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Role</Label>
                            <div className="flex items-center gap-2 mt-1">
                                <Shield className="w-4 h-4 text-blue-600" />
                                <span className="capitalize font-medium bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm">
                                    {profile.role}
                                </span>
                            </div>
                        </div>

                        <div className="pt-6">
                            <Button variant="destructive" className="w-full" onClick={handleLogout}>
                                <LogOut className="w-4 h-4 mr-2" />
                                Log Out
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Change Password */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Key className="w-5 h-5" />
                            Ganti Password
                        </CardTitle>
                        <CardDescription>Amankan akun anda dengan mengganti password secara berkala</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="oldPassword">Password Lama</Label>
                                <Input
                                    id="oldPassword"
                                    type="password"
                                    placeholder="Masukkan password saat ini"
                                    value={passwords.oldPassword}
                                    onChange={(e) => setPasswords({ ...passwords, oldPassword: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">Password Baru</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    placeholder="Minimal 6 karakter"
                                    value={passwords.newPassword}
                                    onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="Ulangi password baru"
                                    value={passwords.confirmPassword}
                                    onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full bg-gray-900 hover:bg-gray-800" disabled={isChangingPassword}>
                                {isChangingPassword ? 'Memproses...' : 'Simpan Password Baru'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
