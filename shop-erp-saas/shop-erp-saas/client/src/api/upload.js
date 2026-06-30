import api from './axios.js';

// Uploads an image file to the backend (which stores it on Cloudinary)
// and returns the public secure URL.
// `type` controls the Cloudinary folder: 'logo' | 'employee' | 'product' | 'misc'.
export async function uploadImage(file, type = 'misc') {
  const fd = new FormData();
  fd.append('image', file);
  fd.append('type', type);
  const { data } = await api.post('/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data.url;
}
