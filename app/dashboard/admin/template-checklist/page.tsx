'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Plus } from 'lucide-react'

interface Kategori {
  id: string
  nama: string
}

interface TemplateItem {
  id: string
  kategori_id: string
  item_label: string
  urutan: number
  is_active: boolean
}

export default function TemplateChecklistPage() {
  const router = useRouter()
  const [kategoris, setKategoris] = useState<Kategori[]>([])
  const [selectedKategori, setSelectedKategori] = useState('')
  const [items, setItems] = useState<TemplateItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [newLabel, setNewLabel] = useState('')

  const fetchData = async () => {
    try {
      const profileId = localStorage.getItem('profileId')
      if (!profileId) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', profileId).single()
      if (!profile || profile.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      const { data: kategoriData } = await supabase
        .from('kategori')
        .select('id, nama')
        .eq('is_active', true)
        .order('nama', { ascending: true })

      const list = kategoriData || []
      setKategoris(list)
      if (!selectedKategori && list.length > 0) {
        setSelectedKategori(list[0].id)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [router])

  const fetchItems = async (kategoriId: string) => {
    if (!kategoriId) return
    const { data } = await supabase
      .from('checklist_template_item')
      .select('id, kategori_id, item_label, urutan, is_active')
      .eq('kategori_id', kategoriId)
      .eq('is_active', true)
      .order('urutan', { ascending: true })
    setItems(data || [])
  }

  useEffect(() => {
    fetchItems(selectedKategori)
  }, [selectedKategori])

  const nextOrder = useMemo(() => {
    if (items.length === 0) return 1
    return Math.max(...items.map((i) => i.urutan || 0)) + 1
  }, [items])

  const handleAdd = async () => {
    if (!selectedKategori || !newLabel.trim()) return
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('checklist_template_item')
        .insert({
          kategori_id: selectedKategori,
          item_label: newLabel.trim(),
          urutan: nextOrder,
          is_active: true,
        })
      if (error) throw error
      setNewLabel('')
      await fetchItems(selectedKategori)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
      const raw = (() => {
        try {
          return JSON.stringify(err)
        } catch {
          return String(err)
        }
      })()
      console.error('Error adding checklist item:', err)
      console.error('Error raw:', raw)
      if (message.toLowerCase().includes('relation') || message.toLowerCase().includes('does not exist')) {
        alert('Gagal menambah item checklist: tabel belum tersedia. Jalankan migration pre-borrow inspection.')
      } else if (message.toLowerCase().includes('row-level security')) {
        alert('Gagal menambah item checklist: akses ditolak. Pastikan login sebagai admin dan RLS policy aktif.')
      } else {
        alert('Gagal menambah item checklist: ' + message)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus item checklist ini?')) return
    const { error } = await supabase
      .from('checklist_template_item')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      alert('Gagal menghapus item')
      return
    }

    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Template Checklist Kategori</h1>
        <p className="text-gray-500 mt-2">Atur item checklist inspeksi awal per kategori barang.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pilih Kategori</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="w-full rounded-md border px-3 py-2"
            value={selectedKategori}
            onChange={(e) => setSelectedKategori(e.target.value)}
          >
            {kategoris.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Item Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Contoh: Layar"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <Button onClick={handleAdd} disabled={isSaving || !selectedKategori || !newLabel.trim()}>
              <Plus className="w-4 h-4 mr-1" /> Tambah
            </Button>
          </div>

          <div className="space-y-2">
            {items.length === 0 ? (
              <div className="text-sm text-gray-500">Belum ada item checklist untuk kategori ini.</div>
            ) : (
              items.map((it, idx) => (
                <div key={it.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="text-sm">
                    {idx + 1}. {it.item_label}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(it.id)}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

