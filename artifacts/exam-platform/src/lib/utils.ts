import { twMerge } from 'tailwind-merge';

import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function optimizeCloudinaryUrl(url: string | null | undefined, options: { width?: number; height?: number; quality?: string } = {}) {
  if (!url) return '';
  if (!url.includes('cloudinary.com')) return url;
  
  // Cloudinary transformations are only supported on image/video upload paths, not raw files
  if (url.includes('/raw/upload/')) return url;
  
  const uploadIndex = url.indexOf('/upload/');
  if (uploadIndex === -1) return url;
  
  const transformations = ['f_auto', 'q_auto'];
  if (options.width) transformations.push(`w_${options.width}`);
  if (options.height) transformations.push(`h_${options.height}`);
  if (options.quality) transformations.push(`q_${options.quality}`);
  
  const insertIndex = uploadIndex + '/upload/'.length;
  return url.slice(0, insertIndex) + transformations.join(',') + '/' + url.slice(insertIndex);
}

export function getCookie(name: string): string | null {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
}

export function setCookie(name: string, value: string, days = 365) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + encodeURIComponent(value || "") + expires + "; path=/; SameSite=Lax";
}
