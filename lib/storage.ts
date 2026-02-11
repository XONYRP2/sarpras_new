import { supabase } from '@/lib/supabase'

interface UploadImageParams {
  bucket: string
  path: string
  file: File
}

export async function uploadImage({ bucket, path, file }: UploadImageParams): Promise<string> {
  const tryUpload = async (bucketName: string) => {
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (uploadError) {
      throw uploadError
    }
    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(path)
    return publicData?.publicUrl || ''
  }

  try {
    return await tryUpload(bucket)
  } catch (err: any) {
    const message = String(err?.message || '')
    const lower = bucket.toLowerCase()
    if (message.toLowerCase().includes('bucket not found') && lower !== bucket) {
      return await tryUpload(lower)
    }
    if (message.toLowerCase().includes('bucket not found')) {
      throw new Error(`Bucket not found: ${bucket}. Pastikan bucket sudah dibuat di Supabase Storage.`)
    }
    throw err
  }
}
