## ۱. فرض‌های مشترک

* Nginx روی این آدرس در دسترسه:
  `http://localhost:8080`  (خودت جایگزین کن در صورت نیاز)
* pg_tileserv پشت Nginx با prefix زیر publish شده:
  `http://localhost:8080/tiles/`
* لایه‌هایی که فعلاً داری:

```json
{
  "public.admin_restrictions": {},
  "public.areas": {},
  "public.areas_simplified": {},
  "public.doors": {},
  "public.mesh_triangles": {},
  "public.poi_points": {},
  "public.qrcodes": {},
  "public.van_edges": {},
  "public.van_nodes": {}
}
```

---

## ۲. کانتکست پیشنهادی برای فرانت (config مرکزی)

این رو می‌تونی به‌عنوان مثلا `src/config/vectorTiles.ts` بذاری:

```ts
// src/config/vectorTiles.ts

const TILE_BASE_URL = "http://localhost:8080/tiles";

export type HaramLayerType = "fill" | "line" | "symbol";

export interface HaramVectorTileLayerConfig {
  id: string;                // شناسه داخلی در MapLibre
  titleFa: string;           // عنوان برای UI فارسی
  table: string;             // نام جدول در PostGIS
  sourceId: string;          // شناسه source در MapLibre
  sourceLayer: string;       // نام لایه داخل MVT (همون table کامل با schema)
  tileUrl: string;           // قالب آدرس تایل
  type: HaramLayerType;      // نوع لایه نمایشی
  minzoom: number;
  maxzoom: number;
  visibleByDefault: boolean;
}

export const haramVectorTileConfig: HaramVectorTileLayerConfig[] = [
  {
    id: "areas-fill",
    titleFa: "محدوده‌ها (ساده‌شده)",
    table: "public.areas_simplified",
    sourceId: "areas-simplified",
    sourceLayer: "public.areas_simplified",
    tileUrl: `${TILE_BASE_URL}/public.areas_simplified/{z}/{x}/{y}.pbf`,
    type: "fill",
    minzoom: 14,
    maxzoom: 20,
    visibleByDefault: true
  },
  {
    id: "areas-outline",
    titleFa: "مرز محدوده‌ها",
    table: "public.areas_simplified",
    sourceId: "areas-simplified",
    sourceLayer: "public.areas_simplified",
    tileUrl: `${TILE_BASE_URL}/public.areas_simplified/{z}/{x}/{y}.pbf`,
    type: "line",
    minzoom: 14,
    maxzoom: 22,
    visibleByDefault: true
  },
  {
    id: "doors",
    titleFa: "درب‌ها",
    table: "public.doors",
    sourceId: "doors",
    sourceLayer: "public.doors",
    tileUrl: `${TILE_BASE_URL}/public.doors/{z}/{x}/{y}.pbf`,
    type: "symbol",
    minzoom: 17,
    maxzoom: 22,
    visibleByDefault: true
  },
  {
    id: "poi-points",
    titleFa: "نقاط علاقه (POI)",
    table: "public.poi_points",
    sourceId: "poi-points",
    sourceLayer: "public.poi_points",
    tileUrl: `${TILE_BASE_URL}/public.poi_points/{z}/{x}/{y}.pbf`,
    type: "symbol",
    minzoom: 16,
    maxzoom: 22,
    visibleByDefault: true
  },
  {
    id: "qrcodes",
    titleFa: "مکان‌های QR",
    table: "public.qrcodes",
    sourceId: "qrcodes",
    sourceLayer: "public.qrcodes",
    tileUrl: `${TILE_BASE_URL}/public.qrcodes/{z}/{x}/{y}.pbf`,
    type: "symbol",
    minzoom: 16,
    maxzoom: 22,
    visibleByDefault: false
  },
  {
    id: "admin-restrictions",
    titleFa: "محدودیت‌های مدیریتی",
    table: "public.admin_restrictions",
    sourceId: "admin-restrictions",
    sourceLayer: "public.admin_restrictions",
    tileUrl: `${TILE_BASE_URL}/public.admin_restrictions/{z}/{x}/{y}.pbf`,
    type: "fill",
    minzoom: 16,
    maxzoom: 22,
    visibleByDefault: false
  },
  {
    id: "van-edges",
    titleFa: "مسیر ون‌ها (خطوط)",
    table: "public.van_edges",
    sourceId: "van-edges",
    sourceLayer: "public.van_edges",
    tileUrl: `${TILE_BASE_URL}/public.van_edges/{z}/{x}/{y}.pbf`,
    type: "line",
    minzoom: 16,
    maxzoom: 22,
    visibleByDefault: false
  },
  {
    id: "van-nodes",
    titleFa: "گره‌های ون",
    table: "public.van_nodes",
    sourceId: "van-nodes",
    sourceLayer: "public.van_nodes",
    tileUrl: `${TILE_BASE_URL}/public.van_nodes/{z}/{x}/{y}.pbf`,
    type: "symbol",
    minzoom: 16,
    maxzoom: 22,
    visibleByDefault: false
  },
  {
    id: "mesh-triangles",
    titleFa: "شبکه مسیریابی (Mesh)",
    table: "public.mesh_triangles",
    sourceId: "mesh-triangles",
    sourceLayer: "public.mesh_triangles",
    tileUrl: `${TILE_BASE_URL}/public.mesh_triangles/{z}/{x}/{y}.pbf`,
    type: "fill",
    minzoom: 18,
    maxzoom: 22,
    visibleByDefault: false   // بیشتر برای دیباگ، نه نمایش دائمی
  }
];
```

> نکته:
> برای لایه‌ی «مسیریابی» (mesh_triangles, van_edges, van_nodes) پیشنهاد می‌کنم در UI فقط در حالت **debug** یا admin نمایش داده شوند، نه برای کاربر نهایی.

---

## ۳. نحوه‌ی استفاده در MapLibre (نمونه‌ی ساده)

در کامپوننت نقشه‌ات (مثلاً `MapView.tsx`)، بعد از `map.on('load', ...)` می‌تونی از این کانفیگ استفاده کنی.

```ts
import maplibregl from "maplibre-gl";
import { haramVectorTileConfig } from "@/config/vectorTiles";

function initVectorLayers(map: maplibregl.Map) {
  // ۱. اول همهٔ source ها را اضافه کن
  const uniqueSources = new Map<string, string>(); // sourceId -> tileUrl

  haramVectorTileConfig.forEach(layerCfg => {
    if (!uniqueSources.has(layerCfg.sourceId)) {
      uniqueSources.set(layerCfg.sourceId, layerCfg.tileUrl);

      map.addSource(layerCfg.sourceId, {
        type: "vector",
        tiles: [layerCfg.tileUrl],
        minzoom: layerCfg.minzoom,
        maxzoom: layerCfg.maxzoom
      });
    }
  });

  // ۲. بعد براساس نوع لایه‌ها (fill/line/symbol) layer اضافه کن
  haramVectorTileConfig.forEach(layerCfg => {
    const commonProps: any = {
      id: layerCfg.id,
      source: layerCfg.sourceId,
      "source-layer": layerCfg.sourceLayer,
      layout: {
        visibility: layerCfg.visibleByDefault ? "visible" : "none"
      }
    };

    if (layerCfg.type === "fill") {
      map.addLayer({
        ...commonProps,
        type: "fill",
        paint: {
          "fill-opacity": 0.3
        }
      } as maplibregl.FillLayer);
    }

    if (layerCfg.type === "line") {
      map.addLayer({
        ...commonProps,
        type: "line",
        paint: {
          "line-width": 1
        }
      } as maplibregl.LineLayer);
    }

    if (layerCfg.type === "symbol") {
      map.addLayer({
        ...commonProps,
        type: "symbol",
        layout: {
          ...commonProps.layout,
          "icon-size": 1,
          // فعلاً بدون آیکون اختصاصی؛ بعداً sprite تعریف می‌کنیم
          "icon-image": "marker-15"
        }
      } as maplibregl.SymbolLayer);
    }
  });
}
```

و در جایی که map رو می‌سازی:

```ts
const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    sources: {},  // خالی؛ ما بعداً addSource می‌کنیم
    layers: []
  },
  center: [59.6159, 36.2861],
  zoom: 16
});

map.on("load", () => {
  initVectorLayers(map);
});
```

---

## ۴. توضیحات تکمیلی برای تیم فرانت

برای استفاده صحیح از این context، چند نکته مهم:

1. **Origin یکسان**
   تمام درخواست‌ها با `http://localhost:8080` انجام می‌شود (API Laravel + tiles)،
   بنابراین مشکل CORS نخواهیم داشت.

2. **ساختار tiles**
   الگوی هر جدول به شکل زیر است:

   * `GET /tiles/public.areas_simplified/{z}/{x}/{y}.pbf`
   * `GET /tiles/public.doors/{z}/{x}/{y}.pbf`
   * …

   و `source-layer` همیشه همان نام کامل جدول با schema است، یعنی:

   * `public.areas_simplified`
   * `public.doors`
   * `public.poi_points`
   * …

3. **نمایش فقط لازم‌ها**

   * برای زوم‌های پایین (مثلاً < 16) فقط `areas_simplified` فعال باشد.
   * برای زوم‌های بالا، درب‌ها، POIها و غیره را روشن کن.
   * mesh و van_* را فقط در حالت debug نشان بده.

4. **گام بعدی**
   در آینده که Function Layer ساختیم (با پارامترهای `floor`, `lang`, `gender`)، فقط کافی است `tileUrl`ها را به جای جدول خام، به endpoint function تغییر بدهیم و بقیه context همین می‌ماند.

---

اگر اوکی هست، قدم بعدی می‌تونه این باشه که:

* یک کامپوننت React واقعی (مثلاً `HaramMap.tsx`) برات بنویسم که همین کانفیگ را استفاده کند و یک toggle panel برای روشن/خاموش کردن لایه‌ها (checkbox کنار `titleFa`) داشته باشد.
