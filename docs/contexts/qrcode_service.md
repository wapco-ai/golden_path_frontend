<context>
ServiceName: QR Location Metadata
Purpose: Given a QR location ID and the active language, return the localized title plus rich metadata (location text, imagery, descriptions, media items, ratings) so MapBeginPage can show correct labels and drill-down content.

Endpoint: GET /api/locations/{id}
Query Parameters:
  - language (optional, default "fa"; accepted: fa, en, ar, ur)
  - includeContents (optional bool, default true)
  - includeComments (optional bool, default false) // to reduce payload if not needed

Sample Request:
  GET /api/locations/saqqakhaneh?language=en&includeComments=true

Sample Response Body:
{
  "id": "saqqakhaneh",
  "title": { "fa": "...", "en": "Razavi Saqqakhaneh", "ar": "...", "ur": "..." },
  "location": {
    "fa": "صحن انقلاب اسلامی | حرم مطهر رضوی",
    "en": "Islamic Revolution Courtyard | Razavi Holy Shrine",
    "ar": "...",
    "ur": "..."
  },
  "images": [
    "https://cdn.yjc.ir/files/fa/news/1403/4/30/19596378_964.jpg",
    "https://cdn.alibaba.ir/ostorage/alibaba-mag/wp-content/uploads/2021/07/SHAKHES.jpg",
    "..."
  ],
  "openingHours": {
    "fa": "۲۴ ساعت باز میباشد",
    "en": "Open 24 hours",
    "ar": "مفتوح 24 ساعة",
    "ur": "24 گھنٹے کھلا ہے"
  },
  "about": {
    "short": { "fa": "...", "en": "...", "ar": "...", "ur": "..." },
    "full": { "fa": "...", "en": "...", "ar": "...", "ur": "..." }
  },
  "contents": [
    {
      "id": "content3",
      "type": "video",
      "title": { "fa": "...", "en": "Hussain's Lament", "ar": "...", "ur": "..." },
      "description": { "fa": "...", "en": "...", "ar": "...", "ur": "..." },
      "fileKey": "v3",
      "thumbnail": "https://cdn.yjc.ir/files/fa/news/1399/3/25/12063504_111.jpg"
    },
    ...
  ],
  "comments": [
    { "id": "comment1", "author": "محمد حسين ميرشفيتي", "text": "آبی که همیشه شفا میدهد", "date": "۴ بهمن", "rating": 4 },
    ...
  ],
  "views": 2,
  "averageRating": 4.5
}

Validation Rules:
- Return HTTP 404 if `id` not found.
- If `language` provided, the backend should still return the full multi-language object but may add `resolvedTitle`/`resolvedLocation` fields for convenience.
- Support future extension fields (e.g., `events`, `nearbyFeatures`) without breaking clients.
</context>
