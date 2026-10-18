const EXTENSION_MIMES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml',
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  avi: 'video/x-msvideo', mkv: 'video/x-matroska', '3gp': 'video/3gpp',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg',
  aac: 'audio/aac', flac: 'audio/flac', opus: 'audio/opus',
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', zip: 'application/zip',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

const mediaValue = (media) => {
  const value = typeof media === 'string'
    ? media : media?.mediaUrl || media?.url || media?.path || media?.src;
  return typeof value === 'string' ? value : '';
};

const rawImageMime = (value) => {
  if (typeof value !== 'string') return '';
  const normalized = value.replace(/\s+/g, '');
  if (normalized.length < 12 || normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) return '';
  let header;
  try {
    // Only inspect the signature; legacy images can contain several megabytes.
    header = atob(normalized.slice(0, 32));
  } catch {
    return '';
  }
  if (header.startsWith('\x89PNG\r\n\x1a\n')) return 'image/png';
  if (header.startsWith('\xff\xd8\xff')) return 'image/jpeg';
  if (header.startsWith('GIF87a') || header.startsWith('GIF89a')) return 'image/gif';
  if (header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP') return 'image/webp';
  if (header.length >= 14 && header.startsWith('BM')) return 'image/bmp';
  return '';
};

const mediaSignals = (media) => {
  const declarations = (typeof media === 'object'
    ? [media?.mime, media?.mimeType, media?.type, media?.fileType, media?.isVideo && 'video'] : [])
    .filter(value => typeof value === 'string' && value.trim())
    .map(value => value.split(';')[0].trim().toLowerCase());
  const declaredMimes = declarations.filter(value => value.includes('/'));
  // Inspect every stored source: a friendly .url must not conceal a video .path.
  const sources = typeof media === 'string' ? [media]
    : [media?.mediaUrl, media?.url, media?.path, media?.src, media?.name, media?.originalName, media?.data];
  const sourceMimes = sources.filter(value => typeof value === 'string').flatMap(value => {
    const mime = value.match(/^data:([^;,]+)/i)?.[1]?.toLowerCase();
    if (mime) return [mime];
    const rawMime = rawImageMime(value);
    if (rawMime) return [rawMime];
    const extension = value.split(/[?#]/)[0].match(/\.([a-z\d]+)$/i)?.[1]?.toLowerCase();
    return EXTENSION_MIMES[extension] ? [EXTENSION_MIMES[extension]] : [];
  });
  return { declarations, declaredMimes, sourceMimes };
};

const mimeKind = (mime) => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('text/') && mime !== 'text/html') return 'document';
  if (/^application\/(?:msword|vnd\.(?:ms-|openxmlformats-)|rtf)/.test(mime)) return 'document';
  return null;
};

export const getMediaKind = (media, fallback = null) => {
  const { declarations, declaredMimes, sourceMimes } = mediaSignals(media);
  const kinds = [...declaredMimes, ...sourceMimes].map(mimeKind);
  // Nonimage evidence wins over stale image flags or an image-looking URL.
  for (const kind of ['video', 'audio', 'pdf']) {
    if (declarations.includes(kind) || kinds.includes(kind)) return kind;
  }
  if (declarations.some(value => ['document', 'file', 'text'].includes(value)) || kinds.includes('document')) return 'document';
  // Unknown/generic MIME and nonimage data URIs cannot become a photo via fallback.
  if ([...declaredMimes, ...sourceMimes].some(mime => !mime.startsWith('image/'))) return null;
  if (declarations.includes('image') || kinds.includes('image')) return 'image';
  if (declarations.length) return null;
  return fallback;
};

export const getMediaMime = (media) => {
  const { declaredMimes, sourceMimes } = mediaSignals(media);
  const kind = getMediaKind(media);
  const matching = [...declaredMimes, ...sourceMimes].find(mime => mimeKind(mime) === kind);
  if (matching) return matching;
  if (kind === 'video') return 'video/mp4';
  if (kind === 'audio') return 'audio/mpeg';
  if (kind === 'pdf') return 'application/pdf';
  return declaredMimes[0] || sourceMimes[0] || '';
};

export const resolveMediaUrl = (media, { apiBaseUrl = '', fileMap = {}, defaultMime = 'image/jpeg' } = {}) => {
  if (!media) return null;
  let value = mediaValue(media);
  if (!value && typeof media === 'object' && media.data) {
    const kind = getMediaKind(media);
    const inferredMime = kind === 'video' ? 'video/mp4' : kind === 'audio' ? 'audio/mpeg'
      : kind === 'pdf' ? 'application/pdf' : defaultMime;
    value = typeof media.data === 'string' && /^data:/i.test(media.data)
      ? media.data : `data:${getMediaMime(media) || inferredMime};base64,${media.data}`;
  }
  if (!value && typeof media === 'object' && media.fileKey) value = fileMap[media.fileKey] || '';
  if (typeof value !== 'string' || !value.trim()) return null;
  value = value.trim();

  const rawMime = rawImageMime(value);
  if (rawMime) {
    return getMediaKind(media) === 'image' ? `data:${rawMime};base64,${value.replace(/\s+/g, '')}` : null;
  }
  // File URLs may come from the API, but executable URL schemes are never media.
  if (/^data:/i.test(value)) return getMediaKind(value) ? value : null;
  if (/^(?:https?:|blob:)/i.test(value)) {
    if (apiBaseUrl && /^https?:/i.test(value)) {
      let parsed;
      try {
        parsed = new URL(value);
      } catch {
        return null;
      }
      if (['localhost', '127.0.0.1'].includes(parsed.hostname)) {
        value = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      } else {
        return value;
      }
    } else {
      return value;
    }
  }
  if (/^\/\//.test(value)) return value;
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || /[\u0000-\u001f]/.test(value)) return null;

  const path = value.replace(/^\.\//, '').replace(/^\//, '');
  const base = apiBaseUrl.replace(/\/$/, '');
  if (path.startsWith('uploads/')) return `${base}/storage/${path}`;
  if (path.startsWith('storage/') || path.startsWith('api/')) return `${base}/${path}`;
  return value;
};

export const localizeMediaText = (value, language = 'fa') => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  return [value[language], value.fa, ...Object.values(value)].find(item => typeof item === 'string' && item) || '';
};

const normalizeMediaText = (value, translations) => {
  if (!translations || typeof translations !== 'object') return value;
  const languageKeys = { fa: ['fa', 'persian', 'farsi'], en: ['en', 'english'], ar: ['ar', 'arabic'], ur: ['ur', 'urdu'] };
  const normalized = typeof value === 'object' && value ? { ...value } : { fa: value || '' };
  let translated = false;
  for (const [language, keys] of Object.entries(languageKeys)) {
    const text = keys.map(key => translations[key]).find(item => typeof item === 'string' && item.trim());
    if (text) {
      normalized[language] = text;
      translated = true;
    }
  }
  return translated ? normalized : value;
};

export const normalizePlaceMedia = (place = {}, options = {}) => {
  const images = [];
  const contents = [];
  const seenImages = new Set();
  const seenContents = new Set();
  const addImage = (media, fallback = null) => {
    if (getMediaKind(media, fallback) !== 'image') return;
    const url = resolveMediaUrl(media, options);
    if (url && !seenImages.has(url)) {
      images.push(url);
      seenImages.add(url);
    }
  };
  for (const field of [place.images, place.image, place.img]) {
    (Array.isArray(field) ? field : [field]).filter(Boolean).forEach(media => addImage(media, 'image'));
  }

  const media = Array.isArray(place.content?.media) ? place.content.media
    : Array.isArray(place.media) ? place.media : [];
  media.forEach(item => addImage(item));

  const addContent = (item, index, legacy = false) => {
    const type = getMediaKind(item);
    if (type === 'image') {
      addImage(item);
      return;
    }
    if (!['video', 'audio', 'pdf', 'document'].includes(type)) return;
    const mediaUrl = resolveMediaUrl(item, options);
    if (!mediaUrl) return;
    const key = `${type}:${mediaUrl}`;
    if (seenContents.has(key)) return;
    seenContents.add(key);
    const thumbnail = typeof item === 'object' ? item.thumbnail || item.poster || item.metadata?.thumbnail : null;
    const thumbnailUrl = thumbnail && getMediaKind(thumbnail, 'image') === 'image'
      ? resolveMediaUrl(thumbnail, options) : null;
    contents.push({
      ...(typeof item === 'object' ? item : {}),
      id: item?.id ?? `${legacy ? 'content' : 'media'}-${index}`,
      type,
      mime: getMediaMime(item) || (type === 'video' ? 'video/mp4' : type === 'pdf' ? 'application/pdf' : ''),
      mediaUrl,
      thumbnail: thumbnailUrl || images[0] || '',
      title: normalizeMediaText(
        item?.title || item?.metadata?.title || item?.name || place.content?.title || place.title || '',
        { ...item?.metadata?.languageTitles, ...item?.languageTitles }
      ),
      description: normalizeMediaText(
        item?.description || item?.body || item?.metadata?.description || place.content?.body || '',
        { ...item?.metadata?.languageDescriptions, ...item?.languageDescriptions }
      )
    });
  };
  (Array.isArray(place.contents) ? place.contents : []).forEach((item, index) => addContent(item, index, true));
  media.forEach((item, index) => addContent(item, index));
  return { images, contents };
};
