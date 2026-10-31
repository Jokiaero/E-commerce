import type { ImagePickerAsset } from 'expo-image-picker';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const extensions: Record<string, string> = {
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const extensionTypes: Record<string, string> = {
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export async function uploadUserImage(asset: ImagePickerAsset, bucket: string): Promise<string> {
  assertSupabaseConfigured();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) throw new Error('Masuk terlebih dahulu untuk mengunggah foto.');

  const file = asset.file ?? await (await fetch(asset.uri)).blob();
  if (file.size > MAX_IMAGE_SIZE) throw new Error('Ukuran foto maksimal 5 MB.');

  const reportedTypes = [asset.mimeType, file.type].map((type) => type?.trim().toLowerCase());
  const reportedMimeType = reportedTypes.find((type): type is string => Boolean(type && type in extensions));
  const fileName = asset.fileName ?? asset.uri.split(/[?#]/, 1)[0];
  const fileExtension = fileName.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = reportedMimeType ?? extensionTypes[fileExtension] ?? 'image/jpeg';
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extensions[mimeType] ?? 'jpg'}`;
  const normalizedFile = new Blob([file], { type: mimeType });
  const { error } = await supabase.storage.from(bucket).upload(path, normalizedFile, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}