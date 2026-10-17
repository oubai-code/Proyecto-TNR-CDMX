/**
 * Supabase Configuration & Client Initialization
 * Project: Proyecto TNR CDMX
 * Connects using the official @supabase/supabase-js client library
 */

const SUPABASE_URL = 'https://snedhbufolvvhrpzpprx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_LtUQ0TKKY0fdMMnbJ8QS7A_a_YanX0L';
const STORAGE_BUCKET = 'animal-images';

// Ensure the Supabase client is initialized once the library is loaded
function getSupabaseClient() {
  if (window._supabaseInstance) {
    return window._supabaseInstance;
  }
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    window._supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    return window._supabaseInstance;
  }
  console.error('Supabase JS library not loaded. Please include @supabase/supabase-js.');
  return null;
}

// Expose client globally
window.getSupabaseClient = getSupabaseClient;
// Pre-initialize if library is already present
if (window.supabase) {
  window.supabaseClient = getSupabaseClient();
} else {
  // Otherwise initialize as soon as DOM loads or script is available
  window.addEventListener('DOMContentLoaded', () => {
    window.supabaseClient = getSupabaseClient();
  });
}

/**
 * Checks whether the given user_id exists in public.admin_users.
 * Returns true if authorized admin, false otherwise.
 */
async function verifyAdminUser(userId) {
  const client = getSupabaseClient();
  if (!client || !userId) return false;

  try {
    const { data, error } = await client
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error verifying admin authorization:', error);
      return false;
    }

    return Boolean(data && data.user_id === userId);
  } catch (err) {
    console.error('Unexpected error checking admin_users:', err);
    return false;
  }
}
window.verifyAdminUser = verifyAdminUser;

/**
 * Uploads a media file (image or video) to the animal-images bucket and returns its public URL.
 * Supports image files (.jpg, .png, .webp, .gif) and video files (.mp4, .webm, .mov).
 */
async function uploadMediaFile(file, options = {}) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');
  if (!file) throw new Error('No file provided for upload');

  // Validate file size (max 50MB for video, 15MB for images)
  const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
  const maxSizeMB = isVideo ? 50 : 15;
  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max allowed size is ${maxSizeMB}MB.`);
  }

  const fileExt = (file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg')).toLowerCase();
  const safeBaseName = (file.name.substring(0, file.name.lastIndexOf('.')) || 'media')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .substring(0, 20);
  const fileName = `${Date.now()}_${safeBaseName}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  // Explicit content-type mapping ensures proper browser streaming and playback
  let contentType = file.type;
  if (!contentType || contentType === 'application/octet-stream') {
    if (fileExt === 'mp4') contentType = 'video/mp4';
    else if (fileExt === 'webm') contentType = 'video/webm';
    else if (fileExt === 'mov') contentType = 'video/quicktime';
    else if (fileExt === 'png') contentType = 'image/png';
    else if (fileExt === 'webp') contentType = 'image/webp';
    else contentType = 'image/jpeg';
  }

  const bucket = options.bucket || STORAGE_BUCKET;

  const { data, error } = await client.storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: '3600',
      contentType: contentType,
      upsert: false
    });

  if (error) {
    throw error;
  }

  const { data: urlData } = client.storage
    .from(bucket)
    .getPublicUrl(fileName);

  if (!urlData || !urlData.publicUrl) {
    throw new Error('Failed to retrieve public URL for uploaded media');
  }

  return urlData.publicUrl;
}
window.uploadMediaFile = uploadMediaFile;

/**
 * Backwards compatibility wrapper for animal photos
 */
async function uploadAnimalImage(file) {
  return uploadMediaFile(file);
}
window.uploadAnimalImage = uploadAnimalImage;

