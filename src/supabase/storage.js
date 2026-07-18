import { supabase } from './config';

const isConfigured = () => {
  return supabase !== null;
};

// --- Local IndexedDB Mock Database for offline fallback ---
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('garrytor_local_db', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('blobs')) {
        db.createObjectStore('blobs');
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

const storeBlobLocal = async (key, blob) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('blobs', 'readwrite');
    const store = tx.objectStore('blobs');
    store.put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const getBlobLocal = async (key) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('blobs', 'readonly');
    const store = tx.objectStore('blobs');
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const deleteBlobLocal = async (key) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('blobs', 'readwrite');
    const store = tx.objectStore('blobs');
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// --- Storage API Exports ---

export const uploadImage = async (userId, file) => {
  const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const path = `originals/${userId}/${filename}`;
  const isGuest = userId === 'guest';

  if (!isConfigured() || isGuest) {
    try {
      await storeBlobLocal(path, file);
      return { path, url: path, error: null };
    } catch (err) {
      return { path: null, url: null, error: err };
    }
  }

  const { data, error } = await supabase.storage
    .from('garrytor-media')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) return { path: null, url: null, error };
  
  const { data: urlData } = supabase.storage
    .from('garrytor-media')
    .getPublicUrl(path);

  return { path, url: urlData.publicUrl, error: null };
};

export const uploadExport = async (userId, imageId, blob) => {
  const path = `exports/${userId}/${imageId}.jpg`;
  const isGuest = userId === 'guest';

  if (!isConfigured() || isGuest) {
    try {
      await storeBlobLocal(path, blob);
      return { path, url: path, error: null };
    } catch (err) {
      return { path: null, url: null, error: err };
    }
  }

  const { data, error } = await supabase.storage
    .from('garrytor-media')
    .upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (error) return { path: null, url: null, error };
  
  const { data: urlData } = supabase.storage
    .from('garrytor-media')
    .getPublicUrl(path);

  return { path, url: urlData.publicUrl, error: null };
};

export const getImageUrl = async (path) => {
  const isLocal = 
    !isConfigured() || 
    path.startsWith('originals/guest/') || 
    path.startsWith('exports/guest/') || 
    path.startsWith('thumbs/') || 
    path.startsWith('exports/thumbs/');

  if (isLocal) {
    try {
      const blob = await getBlobLocal(path);
      if (!blob) throw new Error('Blob not found locally');
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error('Failed to get local blob URL:', err);
      return '';
    }
  }

  const { data: urlData } = supabase.storage
    .from('garrytor-media')
    .getPublicUrl(path);
    
  return urlData.publicUrl;
};

export const deleteImage = async (userId, path) => {
  const isLocal = 
    !isConfigured() || 
    userId === 'guest' || 
    path.startsWith('originals/guest/') || 
    path.startsWith('exports/guest/') || 
    path.startsWith('thumbs/') || 
    path.startsWith('exports/thumbs/');

  if (isLocal) {
    try {
      await deleteBlobLocal(path);
      return { error: null };
    } catch (err) {
      return { error: err };
    }
  }

  const { data, error } = await supabase.storage
    .from('garrytor-media')
    .remove([path]);
    
  return { error };
};
