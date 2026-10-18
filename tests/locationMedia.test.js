import assert from 'node:assert/strict';
import test from 'node:test';
import { getMediaKind, getMediaMime, localizeMediaText, normalizePlaceMedia, resolveMediaUrl } from '../src/utils/locationMedia.js';
import { normalizeCulturalItem } from '../src/services/culturalItemMapper.js';

const options = { apiBaseUrl: 'https://golden.example', fileMap: { v1: '/assets/videos/vid1.mp4', pdf1: '/assets/pdfs/pdf1.pdf' } };

test('maps uploaded videos below the images without changing cultural text or metadata', () => {
  const video = { type: 'video', mime: 'video/mp4', path: 'uploads/contents/7/video.mp4', name: 'مستند حرم', metadata: { size: 1000 } };
  const result = normalizePlaceMedia({
    image: '/storage/uploads/contents/7/photo.jpg',
    content: { title: 'عنوان مکان', body: 'توضیح فرهنگی', media: [video, { type: 'image', mime: 'image/jpeg', path: 'uploads/contents/7/photo.jpg' }] }
  }, options);
  assert.deepEqual(result.images, ['https://golden.example/storage/uploads/contents/7/photo.jpg']);
  assert.equal(result.contents.length, 1);
  assert.equal(result.contents[0].type, 'video');
  assert.equal(result.contents[0].mediaUrl, 'https://golden.example/storage/uploads/contents/7/video.mp4');
  assert.equal(result.contents[0].thumbnail, result.images[0]);
  assert.equal(result.contents[0].title, 'مستند حرم');
  assert.equal(result.contents[0].description, 'توضیح فرهنگی');
  assert.deepEqual(result.contents[0].metadata, video.metadata);
  assert.equal(result.contents[0].mime, 'video/mp4');
});

test('never treats videos, audio, documents, or unknown media as gallery images', () => {
  const result = normalizePlaceMedia({
    image: '/storage/video.mp4',
    images: [{ mime: 'video/mp4', url: '/storage/stream' }, '/storage/doc.pdf'],
    content: { media: [
      { mime: 'audio/mpeg', path: '/storage/audio.mp3' },
      { mime: 'application/pdf', path: '/storage/doc.pdf' },
      { url: '/storage/unknown' },
      { mime: 'application/octet-stream', url: '/storage/unknown-file' },
      { type: 'video', url: '/storage/movie.mp4' }
    ] }
  }, options);
  assert.deepEqual(result.images, []);
  assert.deepEqual(result.contents.map(item => item.type), ['audio', 'pdf', 'video']);
  assert.ok(result.contents.every(item => item.thumbnail === ''));
});

test('supports direct audio and document URLs and preserves legacy file keys and multilingual titles', () => {
  const titles = { fa: 'فیلم قدیمی', en: 'Legacy film' };
  const result = normalizePlaceMedia({
    contents: [
      { id: 'old', type: 'video', fileKey: 'v1', title: titles, description: { fa: 'توضیح' } },
      { id: 'doc', type: 'pdf', fileKey: 'pdf1', title: { fa: 'سند' } }
    ],
    content: { media: [
      { type: 'audio', mime: 'audio/mpeg', url: 'https://cdn.example/talk.mp3', title: 'صوت' },
      { type: 'file', mime: 'application/msword', url: '/storage/history.doc', name: 'تاریخچه' }
    ] }
  }, options);
  assert.equal(result.contents[0].mediaUrl, options.fileMap.v1);
  assert.equal(result.contents[0].title, titles);
  assert.equal(result.contents[1].mediaUrl, options.fileMap.pdf1);
  assert.equal(result.contents[2].mediaUrl, 'https://cdn.example/talk.mp3');
  assert.equal(result.contents[3].type, 'document');
  assert.equal(result.contents[3].mediaUrl, 'https://golden.example/storage/history.doc');
  assert.equal(localizeMediaText(titles, 'en'), 'Legacy film');
  assert.equal(localizeMediaText('عنوان تک‌زبانه', 'fa'), 'عنوان تک‌زبانه');
});

test('resolves stored relative paths and local-development URLs against the API origin', () => {
  for (const value of ['uploads/contents/7/v.mp4', '/uploads/contents/7/v.mp4', './uploads/contents/7/v.mp4', '/storage/uploads/contents/7/v.mp4', 'http://localhost:8080/storage/uploads/contents/7/v.mp4']) {
    assert.equal(resolveMediaUrl({ url: value }, options), 'https://golden.example/storage/uploads/contents/7/v.mp4');
  }
  assert.equal(resolveMediaUrl({ path: 'api/v1/files?path=x.mp4' }, options), 'https://golden.example/api/v1/files?path=x.mp4');
  assert.equal(resolveMediaUrl({ src: 'https://cdn.example/v.mp4' }, options), 'https://cdn.example/v.mp4');
  assert.equal(resolveMediaUrl({ mime: 'video/mp4', data: 'AAAA' }, options), 'data:video/mp4;base64,AAAA');
  assert.equal(resolveMediaUrl({ mime: 'image/png', data: 'data:image/png;base64,AAAA' }, options), 'data:image/png;base64,AAAA');
});

test('rejects executable URLs and unknown inline content before rendering or opening a document', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html;base64,AAAA', 'vbscript:alert(1)', 'file:///tmp/a.mp4']) {
    assert.equal(resolveMediaUrl({ type: 'video', url }, options), null);
  }
  assert.deepEqual(normalizePlaceMedia({ content: { media: [{ type: 'video', url: 'javascript:alert(1)' }] } }, options).contents, []);
});

test('infers safe legacy media kinds from file names, MIME strings, and data URLs', () => {
  assert.equal(getMediaKind('/storage/photo.webp?version=2'), 'image');
  assert.equal(getMediaKind({ type: 'video/mp4', url: '/storage/no-extension' }), 'video');
  assert.equal(getMediaKind({ mime: 'application/octet-stream', name: 'document.pdf', url: '/storage/file' }), 'pdf');
  assert.equal(getMediaKind('data:image/png;base64,AAAA'), 'image');
  assert.equal(getMediaKind({ mime: 'text/html', type: 'image' }, 'image'), null);
  assert.equal(getMediaKind({ url: '/storage/unknown' }), null);
  assert.equal(getMediaMime({ mime: 'VIDEO/MP4; codecs=avc1' }), 'video/mp4');
  assert.equal(getMediaKind({ url: 42, name: {} }), null);
});

test('deduplicates a thumbnail and media repeated by the list API or legacy contents', () => {
  const result = normalizePlaceMedia({
    image: '/storage/photo.jpg', images: ['/storage/photo.jpg'],
    contents: [{ id: 'legacy', type: 'video', url: '/storage/video.mp4' }],
    content: { media: [{ type: 'image', url: '/storage/photo.jpg' }, { type: 'video', url: '/storage/video.mp4' }] }
  }, options);
  assert.equal(result.images.length, 1);
  assert.equal(result.contents.length, 1);
  assert.equal(result.contents[0].id, 'legacy');
});

test('chooses only an image as cultural primary even when a video has the primary flag', () => {
  const item = normalizeCulturalItem({
    primaryImage: '/storage/movie.mp4',
    media: [
      { mime: 'video/mp4', url: '/storage/movie.mp4', isPrimary: true },
      { mime: 'application/pdf', url: '/storage/doc.pdf' },
      { mime: 'image/jpeg', url: '/storage/photo.jpg' }
    ]
  });
  assert.equal(item.primaryImage, '/storage/photo.jpg');
  assert.equal(normalizeCulturalItem({ primaryImage: '/storage/movie.mp4', media: [{ type: 'video', url: '/storage/movie.mp4' }] }).primaryImage, null);
  assert.equal(normalizeCulturalItem({ media: { fa: [{ type: 'image', mime: 'image/png', data: 'AAAA' }] } }).primaryImage, 'data:image/png;base64,AAAA');
  assert.equal(normalizeCulturalItem({ media: { fa: [{ mime: 'image/png', data: 'data:image/png;base64,AAAA' }] } }).primaryImage, 'data:image/png;base64,AAAA');
});

test('contradictory image flags never override a nonimage kind or any stored nonimage source', () => {
  const contradictions = [
    { type: 'image', mime: 'image/jpeg', url: '/film.mp4' },
    { type: 'video', mime: 'image/jpeg', url: '/film' },
    { type: 'video', url: '/looks.jpg' },
    { type: 'image', mime: 'image/jpeg', url: '/looks.jpg', path: '/film.mp4' },
    { type: 'image', mime: 'image/jpeg', url: '/film.mp4', path: '/looks.jpg' },
    { type: 'image', mime: 'image/jpeg', url: '/looks.jpg', src: '/voice.mp3' },
    { type: 'image', mime: 'image/jpeg', url: '/looks.jpg', name: 'document.pdf' },
    { type: 'image', mime: 'image/jpeg', url: '/looks.jpg', path: '/archive.zip' },
    { type: 'image', mime: 'application/octet-stream', url: '/looks.jpg' },
    { type: 'image', mime: 'application/x-unknown', url: '/looks.jpg' },
    { type: 'image', mime: 'image/jpeg', url: 'data:video/mp4;base64,AAAA' },
    { type: 'image', mime: 'image/jpeg', url: '/looks.jpg', path: 'data:text/html;base64,AAAA' }
  ];
  for (const media of contradictions) {
    assert.notEqual(getMediaKind(media, 'image'), 'image', JSON.stringify(media));
    assert.deepEqual(normalizePlaceMedia({ image: media, content: { media: [media] } }, options).images, [], JSON.stringify(media));
    assert.equal(normalizeCulturalItem({ primaryImage: media, media: [media] }).primaryImage, null, JSON.stringify(media));
  }
  assert.equal(getMediaMime(contradictions[0]), 'video/mp4');
  assert.equal(getMediaMime(contradictions[1]), 'video/mp4');
});

test('shows uploaded title and description translations saved in attachment metadata', () => {
  const metadata = {
    title: 'عنوان فارسی', description: 'توضیح فارسی',
    languageTitles: { english: 'English title', arabic: 'عنوان عربي', urdu: 'اردو عنوان' },
    languageDescriptions: { en: 'English description', ar: 'وصف عربي', ur: 'اردو تفصیل' }
  };
  const [content] = normalizePlaceMedia({ content: { media: [{ type: 'video', mime: 'video/mp4', url: '/storage/video.mp4', name: 'file.mp4', metadata }] } }, options).contents;
  assert.equal(localizeMediaText(content.title, 'fa'), 'عنوان فارسی');
  assert.equal(localizeMediaText(content.title, 'en'), 'English title');
  assert.equal(localizeMediaText(content.title, 'ar'), 'عنوان عربي');
  assert.equal(localizeMediaText(content.title, 'ur'), 'اردو عنوان');
  assert.equal(localizeMediaText(content.description, 'en'), 'English description');
  assert.equal(localizeMediaText(content.description, 'ar'), 'وصف عربي');
  assert.equal(localizeMediaText(content.description, 'ur'), 'اردو تفصیل');
  assert.equal(localizeMediaText(content.title, 'de'), 'عنوان فارسی');
  assert.deepEqual(content.metadata, metadata);
});

test('preserves a legacy bare base64 image as the only primary and public gallery image', () => {
  // A complete valid one-pixel PNG, matching historical media.fa string storage.
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jAf8AAAAASUVORK5CYII=';
  for (const encoded of [png, png.replace(/=+$/, '')]) {
    const expected = `data:image/png;base64,${encoded}`;
    const item = normalizeCulturalItem({ media: { fa: [encoded] } });
    assert.equal(item.primaryImage, expected);
    assert.deepEqual(normalizePlaceMedia({ content: { media: [encoded] } }, options), { images: [expected], contents: [] });
    assert.equal(getMediaKind(encoded), 'image');
    assert.equal(getMediaMime(encoded), 'image/png');
    assert.equal(resolveMediaUrl(encoded), expected);
  }
  assert.equal(getMediaKind('VGhpcyBpcyBub3QgYW4gaW1hZ2U='), null);
  assert.deepEqual(normalizePlaceMedia({ content: { media: ['VGhpcyBpcyBub3QgYW4gaW1hZ2U='] } }, options).images, []);
  assert.deepEqual(normalizePlaceMedia({ content: { media: [{ type: 'video', url: png }] } }, options).images, []);
  assert.equal(normalizeCulturalItem({ media: { fa: [{ type: 'video', url: png }] } }).primaryImage, null);
});

test('recognizes only known raw image signatures without overriding an explicit video kind', () => {
  const signatures = [
    ['image/jpeg', Buffer.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1]).toString('base64')],
    ['image/gif', Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00').toString('base64')],
    ['image/webp', Buffer.from('RIFF\x04\x00\x00\x00WEBPVP8 ').toString('base64')],
    ['image/bmp', Buffer.from('BM\x36\x00\x00\x00\x00\x00\x00\x00\x36\x00\x00\x00').toString('base64')]
  ];
  for (const [mime, encoded] of signatures) {
    assert.equal(getMediaMime(encoded), mime);
    assert.equal(resolveMediaUrl(encoded), `data:${mime};base64,${encoded}`);
    assert.equal(getMediaKind({ type: 'video', url: encoded }, 'image'), 'video');
    assert.equal(resolveMediaUrl({ type: 'video', url: encoded }), null);
  }
});
