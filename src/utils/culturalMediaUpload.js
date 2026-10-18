import { resolveMediaUrl } from './locationMedia.js';

const MiB = 1024 * 1024;

export const CULTURAL_UPLOAD_RULES = {
  image: {
    accept: '.jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif',
    extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    maxBytes: 5 * MiB,
    help: 'فرمت‌های مجاز: JPG، JPEG، PNG، WebP، GIF؛ حداکثر حجم هر تصویر: ۵ مگابایت'
  },
  video: {
    accept: '.mp4,video/mp4',
    extensions: ['mp4'],
    mimes: ['video/mp4'],
    maxBytes: 50 * MiB,
    help: 'فرمت مجاز: MP4؛ حداکثر حجم هر ویدیو: ۵۰ مگابایت'
  },
  audio: {
    accept: 'audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus',
    extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'],
    maxBytes: 50 * MiB,
    help: 'فرمت‌های صوتی؛ حداکثر حجم هر فایل: ۵۰ مگابایت'
  },
  text: {
    accept: '.pdf,.txt,.doc,.docx,.xls,.xlsx',
    extensions: ['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx'],
    maxBytes: 50 * MiB,
    help: 'فرمت‌های مجاز: PDF، TXT، DOC، DOCX، XLS، XLSX؛ حداکثر حجم هر فایل: ۵۰ مگابایت'
  }
};

export function validateCulturalUpload(file, kind) {
  const rule = CULTURAL_UPLOAD_RULES[kind];
  if (!rule || !file) return 'نوع فایل نامعتبر است';
  const name = String(file.name || 'فایل');
  const extension = name.split('.').pop().toLowerCase();
  const mime = String(file.type || '').toLowerCase();
  const genericMime = !mime || mime === 'application/octet-stream';
  const validFormat = kind === 'audio'
    ? mime.startsWith('audio/') || (genericMime && rule.extensions.includes(extension))
    : rule.extensions.includes(extension) && (
      !rule.mimes || genericMime || rule.mimes.includes(mime)
    );
  if (!validFormat) return `${name}: فرمت فایل مجاز نیست. ${rule.help}`;
  if (!Number.isFinite(file.size) || file.size <= 0) return `${name}: فایل خالی یا نامعتبر است`;
  if (file.size > rule.maxBytes) return `${name}: حجم فایل بیش از حد مجاز است. ${rule.help}`;
  return null;
}

export function culturalUploadMime(file, kind) {
  const mime = String(file?.type || '').toLowerCase();
  if (mime && mime !== 'application/octet-stream') return mime;
  const extension = String(file?.name || '').split('.').pop().toLowerCase();
  const mimes = {
    image: { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' },
    video: { mp4: 'video/mp4' },
    audio: { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', opus: 'audio/ogg' }
  };
  return mimes[kind]?.[extension] || mime || 'application/octet-stream';
}

export function culturalMediaKind(file) {
  const types = [file?.mime, file?.type, file?.fileType, file?.isVideo && 'video']
    .map((value) => String(value || '').toLowerCase());
  const paths = [file?.path, file?.url, file?.name].filter(Boolean).map(String);
  const dataMime = paths.map((path) => path.match(/^data:([^;]+);/)?.[1]?.toLowerCase()).find(Boolean);
  if (dataMime) types.push(dataMime);
  const hasKind = (kind) => types.some((value) => value === kind || value.startsWith(`${kind}/`));
  // Old records can have contradictory image flags. A video/audio source must
  // stay outside the image collection even when another field calls it an image.
  if (hasKind('video') || paths.some((path) => /\.(?:mp4|m4v|mov|webm|avi|mkv)(?:[?#]|$)/i.test(path))) return 'video';
  if (hasKind('audio') || paths.some((path) => /\.(?:mp3|wav|ogg|m4a|aac|flac|opus)(?:[?#]|$)/i.test(path))) return 'audio';
  const mime = String(file?.mime || '').toLowerCase();
  if (mime && mime !== 'application/octet-stream' && !mime.startsWith('image/') && mime !== 'image') return 'text';
  if (hasKind('image') || paths.some((path) => /\.(?:jpe?g|png|gif|webp|avif|bmp|svg|ico)(?:[?#]|$)/i.test(path))) return 'image';
  return 'text';
}

export function splitCulturalMedia(files = []) {
  const result = { images: [], videos: [], audio: [], documents: [] };
  const targets = { image: 'images', video: 'videos', audio: 'audio', text: 'documents' };
  const seen = new Set();
  for (const file of files) {
    if (!file || !(file.url || file.path)) continue;
    const key = file.path || file.url;
    if (seen.has(key)) continue;
    seen.add(key);
    result[targets[culturalMediaKind(file)]].push(file);
  }
  return result;
}

export function culturalFileMetadata(file, uploadedMetadata = {}) {
  const result = { ...(file?.metaData || {}), ...(file?.metadata || {}), ...(uploadedMetadata || {}) };
  for (const key of ['title', 'description', 'languageTitles', 'languageDescriptions', 'originalName']) {
    if (file?.[key] != null) result[key] = file[key];
  }
  return Object.keys(result).length ? result : null;
}

export function buildCulturalAttachmentPayload(files = []) {
  const seen = new Set();
  return files.flatMap((file) => {
    const path = file?.path || file?.url;
    if (!path || seen.has(path)) return [];
    seen.add(path);
    const kind = culturalMediaKind(file);
    return [{
      type: kind === 'text' ? 'file' : kind,
      mime: file.mime || file.type || 'application/octet-stream',
      path,
      url: file.url || path,
      metadata: culturalFileMetadata(file),
      bucket: file.bucket,
      orientation: file.orientation ?? null,
      name: file.name,
      isPrimary: kind === 'image' && file.isPrimary === true,
      title: file.title ?? file.metadata?.title,
      description: file.description ?? file.metadata?.description
    }];
  });
}

export function selectCulturalPrimaryImage(files = [], selectedId) {
  const images = files.filter((file) => culturalMediaKind(file) === 'image');
  return images.find((file) => file.id === selectedId)
    || images.find((file) => file.isPrimary)
    || images[0]
    || null;
}

export function markCulturalPrimaryImage(files = [], selectedId) {
  const primary = selectCulturalPrimaryImage(files, selectedId);
  return files.map((file) => ({ ...file, isPrimary: file === primary }));
}

export function findExistingCulturalPrimary(primary, images = []) {
  const identity = (file) => resolveMediaUrl(file?.url || file?.path || file?.src || file);
  const key = identity(primary);
  return key ? images.find((image) => identity(image) === key) || null : null;
}
