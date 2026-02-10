import { supabase } from '@/lib/supabase'

interface UploadImageParams {
  bucket: string
  path: string
  file: File
}

export async function uploadImage({ bucket, path, file }: UploadImageParams): Promise<string> {
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (uploadError) {
    throw uploadError
  }

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path)
  return publicData?.publicUrl || ''
}
