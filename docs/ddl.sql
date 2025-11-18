-- =========================================
-- 0) پیش‌نیازها
-- =========================================
CREATE EXTENSION IF NOT EXISTS postgis;

-- =========================================
-- 1) ENUM ها
-- =========================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'area_type_enum') THEN
    CREATE TYPE area_type_enum AS ENUM ('courtyard','riwaq','iwan','mosque','elevator_area','stair_area','ramp_area','admin_zone');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_enum') THEN
    CREATE TYPE gender_enum AS ENUM ('male','female','both');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'poi_type_enum') THEN
    CREATE TYPE poi_type_enum AS ENUM ('courtyard_name','elevator','stair','ramp','cloakroom','landmark','toilet','info_desk','entrance','exit','prayer_room','water','rest_area');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'van_node_type_enum') THEN
    CREATE TYPE van_node_type_enum AS ENUM ('stop','junction');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'target_type_enum') THEN
    CREATE TYPE target_type_enum AS ENUM ('poi','door','area','coordinate');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lang_enum') THEN
    CREATE TYPE lang_enum AS ENUM ('fa','ar','en','ur');
  END IF;
END$$;

-- =========================================
-- 2) جداول اصلی مکانی (Areas / Doors / POIs)
-- =========================================
CREATE TABLE IF NOT EXISTS areas (
  id                BIGSERIAL PRIMARY KEY,
  geom              geometry(MultiPolygon, 32640) NOT NULL,
  area_type         area_type_enum NOT NULL,
  floor             SMALLINT NOT NULL CHECK (floor IN (0,-1)),
  allowed_gender    gender_enum NOT NULL DEFAULT 'both',
  is_closed         BOOLEAN NOT NULL DEFAULT FALSE,
  weight_open_space NUMERIC(6,3) NOT NULL DEFAULT 1.0,
  attrs             JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS areas_gix       ON areas USING GIST (geom);
CREATE INDEX IF NOT EXISTS areas_floor_idx  ON areas (floor);

CREATE TABLE IF NOT EXISTS doors (
  id               BIGSERIAL PRIMARY KEY,
  geom             geometry(LineString, 32640) NOT NULL,
  from_area        BIGINT REFERENCES areas(id) ON DELETE RESTRICT,
  to_area          BIGINT REFERENCES areas(id) ON DELETE RESTRICT,
  floor            SMALLINT NOT NULL CHECK (floor IN (0,-1)),
  allowed_gender   gender_enum NOT NULL DEFAULT 'both',
  is_open          BOOLEAN NOT NULL DEFAULT TRUE,
  modes            TEXT[] NOT NULL DEFAULT ARRAY['walk','wheelchair'],
  bidirectional    BOOLEAN NOT NULL DEFAULT TRUE,
  attrs            JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS doors_gix         ON doors USING GIST (geom);
CREATE INDEX IF NOT EXISTS doors_floor_idx   ON doors (floor);
CREATE INDEX IF NOT EXISTS doors_from_to_idx ON doors (from_area, to_area);

CREATE TABLE IF NOT EXISTS poi_points (
  id          BIGSERIAL PRIMARY KEY,
  geom        geometry(Point, 32640) NOT NULL,
  poi_type    poi_type_enum NOT NULL,
  floor       SMALLINT NOT NULL CHECK (floor IN (0,-1)),
  has_content BOOLEAN NOT NULL DEFAULT FALSE,
  attrs       JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS poi_gix        ON poi_points USING GIST (geom);
CREATE INDEX IF NOT EXISTS poi_floor_idx  ON poi_points (floor);
CREATE INDEX IF NOT EXISTS poi_type_idx   ON poi_points (poi_type);

-- =========================================
-- 3) گراف ون برقی
-- =========================================
CREATE TABLE IF NOT EXISTS van_nodes (
  id        BIGSERIAL PRIMARY KEY,
  geom      geometry(Point, 32640) NOT NULL,
  node_type van_node_type_enum NOT NULL DEFAULT 'junction',
  floor     SMALLINT NOT NULL CHECK (floor IN (0,-1))
);
CREATE INDEX IF NOT EXISTS van_nodes_gix       ON van_nodes USING GIST (geom);
CREATE INDEX IF NOT EXISTS van_nodes_floor_idx ON van_nodes (floor);

CREATE TABLE IF NOT EXISTS van_edges (
  id        BIGSERIAL PRIMARY KEY,
  src       BIGINT NOT NULL REFERENCES van_nodes(id) ON DELETE CASCADE,
  dst       BIGINT NOT NULL REFERENCES van_nodes(id) ON DELETE CASCADE,
  length_m  NUMERIC(8,2),
  one_way   BOOLEAN NOT NULL DEFAULT TRUE,
  is_open   BOOLEAN NOT NULL DEFAULT TRUE,
  attrs     JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS van_edges_src_idx  ON van_edges (src);
CREATE INDEX IF NOT EXISTS van_edges_dst_idx  ON van_edges (dst);
CREATE INDEX IF NOT EXISTS van_edges_open_idx ON van_edges (is_open);

-- جلوگیری از self-loop
CREATE OR REPLACE FUNCTION _van_edge_no_self_loop() RETURNS trigger AS $$
BEGIN
  IF NEW.src = NEW.dst THEN
    RAISE EXCEPTION 'van_edges: src and dst cannot be equal';
  END IF;
  RETURN NEW;
END$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_van_edges_no_self_loop') THEN
    CREATE TRIGGER trg_van_edges_no_self_loop
    BEFORE INSERT OR UPDATE ON van_edges
    FOR EACH ROW EXECUTE FUNCTION _van_edge_no_self_loop();
  END IF;
END$$;

-- =========================================
-- 4) محتوا و چندزبانه
-- =========================================
CREATE TABLE IF NOT EXISTS contents (
  id       BIGSERIAL PRIMARY KEY,
  poi_id   BIGINT NOT NULL REFERENCES poi_points(id) ON DELETE CASCADE,
  lang     lang_enum NOT NULL,
  title    TEXT,
  body     TEXT,
  media    JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (poi_id, lang)
);
CREATE INDEX IF NOT EXISTS contents_lang_idx ON contents (lang);

CREATE TABLE IF NOT EXISTS i18n_texts (
  id            BIGSERIAL PRIMARY KEY,
  entity_table  TEXT NOT NULL CHECK (entity_table IN ('areas','doors','poi_points','van_nodes','qrcodes','categories'))),
  entity_id     BIGINT NOT NULL,
  field         TEXT NOT NULL CHECK (field IN ('name','short','desc')),
  lang          lang_enum NOT NULL,
  txt           TEXT NOT NULL,
  UNIQUE (entity_table, entity_id, field, lang)
);
CREATE INDEX IF NOT EXISTS i18n_entity_idx ON i18n_texts (entity_table, entity_id);
CREATE INDEX IF NOT EXISTS i18n_lang_idx   ON i18n_texts (lang);

-- لیبل با Fallback
CREATE OR REPLACE FUNCTION fn_i18n_label(
  p_entity_table TEXT,
  p_entity_id    BIGINT,
  p_field        TEXT,
  p_lang         lang_enum,
  p_fallback     lang_enum DEFAULT 'en'
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_txt TEXT;
BEGIN
  SELECT txt INTO v_txt
  FROM i18n_texts
  WHERE entity_table = p_entity_table
    AND entity_id    = p_entity_id
    AND field        = p_field
    AND lang         = p_lang
  LIMIT 1;

  IF v_txt IS NOT NULL THEN RETURN v_txt; END IF;

  SELECT txt INTO v_txt
  FROM i18n_texts
  WHERE entity_table = p_entity_table
    AND entity_id    = p_entity_id
    AND field        = p_field
    AND lang         = p_fallback
  LIMIT 1;

  IF v_txt IS NOT NULL THEN RETURN v_txt; END IF;

  SELECT txt INTO v_txt
  FROM i18n_texts
  WHERE entity_table = p_entity_table
    AND entity_id    = p_entity_id
    AND field        = p_field
  ORDER BY lang
  LIMIT 1;

  RETURN v_txt;
END;
$$;

-- عبارات صوتی و الگوهای متنی راهنما (اختیاری)
CREATE TABLE IF NOT EXISTS audio_phrases (
  id         BIGSERIAL PRIMARY KEY,
  phrase_key TEXT NOT NULL,
  lang       lang_enum NOT NULL,
  file_path  TEXT NOT NULL,
  meta       JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (phrase_key, lang)
);

CREATE TABLE IF NOT EXISTS instruction_templates (
  id            BIGSERIAL PRIMARY KEY,
  template_key  TEXT NOT NULL,
  lang          lang_enum NOT NULL,
  template      TEXT NOT NULL,
  UNIQUE (template_key, lang)
);

-- =========================================
-- 5) جدول زبانها
-- =========================================
-- PostgreSQL DDL/DML for the `languages` table
CREATE TABLE IF NOT EXISTS languages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    english_name VARCHAR(255) NOT NULL,
    locale VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(8) NOT NULL UNIQUE,
    direction VARCHAR(3) NOT NULL CHECK (direction IN ('ltr', 'rtl')) DEFAULT 'ltr',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    flag_icon_url VARCHAR(255) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO languages (
    name,
    english_name,
    locale,
    code,
    direction,
    is_default,
    is_active,
    flag_icon_url,
    created_at,
    updated_at
) VALUES
    ('فارسی', 'Persian', 'fa_IR', 'fa', 'rtl', TRUE, TRUE, 'https://flagcdn.com/w320/ir.png', NOW(), NOW()),
    ('اردو', 'Urdu', 'ur_PK', 'ur', 'rtl', FALSE, TRUE, 'https://flagcdn.com/w320/pk.png', NOW(), NOW()),
    ('العربية', 'Arabic', 'ar_SA', 'ar', 'rtl', FALSE, TRUE, 'https://flagcdn.com/w320/sa.png', NOW(), NOW()),
    ('English', 'English', 'en_US', 'en', 'ltr', FALSE, TRUE, 'https://flagcdn.com/w320/us.png', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    english_name = EXCLUDED.english_name,
    locale = EXCLUDED.locale,
    direction = EXCLUDED.direction,
    is_default = EXCLUDED.is_default,
    is_active = EXCLUDED.is_active,
    flag_icon_url = EXCLUDED.flag_icon_url,
    updated_at = NOW();
	
-- =========================================
-- 5) QR کدها
-- =========================================
CREATE TABLE IF NOT EXISTS qrcodes (
  id           BIGSERIAL PRIMARY KEY,
  code         TEXT UNIQUE NOT NULL,
  geom         geometry(Point, 32640) NOT NULL,
  target_type  target_type_enum NOT NULL,
  target_id    BIGINT,
  version      INT NOT NULL DEFAULT 1,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  attrs        JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS qrcodes_gix        ON qrcodes USING GIST (geom);
CREATE INDEX IF NOT EXISTS qrcodes_active_idx ON qrcodes (is_active);

-- =========================================
-- 6) اوقات شرعی و تقویم
-- =========================================
CREATE TABLE IF NOT EXISTS prayer_times (
  d        DATE PRIMARY KEY,
  fajr     TIME,
  dhuhr    TIME,
  maghrib  TIME
);

CREATE TABLE IF NOT EXISTS calendars (
  d       DATE PRIMARY KEY,
  shamsi  TEXT,
  qamari  TEXT,
  flags   JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- =========================================
-- 7) قوانینِ پایدار و انتساب‌ها
-- =========================================
CREATE TABLE IF NOT EXISTS rule_sets (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  precedence  TEXT[] NOT NULL DEFAULT ARRAY['qamari','hourly','shamsi']
);

CREATE TABLE IF NOT EXISTS rule_assignments (
  id            BIGSERIAL PRIMARY KEY,
  rule_set_id   BIGINT NOT NULL REFERENCES rule_sets(id) ON DELETE CASCADE,
  target_table  TEXT   NOT NULL CHECK (target_table IN ('areas','doors','van_edges')),
  target_id     BIGINT NOT NULL,
  gender        gender_enum NOT NULL DEFAULT 'both',
  modes         TEXT[] NOT NULL DEFAULT ARRAY['walk','wheelchair','van'],
  time_window           JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS rule_assignments_target_idx   ON rule_assignments (target_table, target_id);
CREATE INDEX IF NOT EXISTS rule_assignments_ruleset_idx  ON rule_assignments (rule_set_id);

-- =========================================
-- 8) NavMesh (برای پیاده/ویلچر)
-- =========================================
CREATE TABLE IF NOT EXISTS mesh_triangles (
  id        BIGSERIAL PRIMARY KEY,
  geom      geometry(Polygon, 32640) NOT NULL,
  floor     SMALLINT NOT NULL CHECK (floor IN (0,-1)),
  area_id   BIGINT REFERENCES areas(id) ON DELETE SET NULL,
  attrs     JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS mesh_triangles_gix       ON mesh_triangles USING GIST (geom);
CREATE INDEX IF NOT EXISTS mesh_triangles_floor_idx ON mesh_triangles (floor);

CREATE TABLE IF NOT EXISTS mesh_adjacency (
  id        BIGSERIAL PRIMARY KEY,
  tri_a     BIGINT NOT NULL REFERENCES mesh_triangles(id) ON DELETE CASCADE,
  tri_b     BIGINT NOT NULL REFERENCES mesh_triangles(id) ON DELETE CASCADE,
  door_id   BIGINT REFERENCES doors(id) ON DELETE SET NULL,
  cost_w    NUMERIC(10,4) NOT NULL DEFAULT 1.0
);
CREATE UNIQUE INDEX IF NOT EXISTS mesh_adjacency_pair_uidx
  ON mesh_adjacency (LEAST(tri_a, tri_b), GREATEST(tri_a, tri_b));

-- =========================================
-- 9) گزارش سبک
-- =========================================
CREATE TABLE IF NOT EXISTS route_logs (
  id               BIGSERIAL PRIMARY KEY,
  ts               TIMESTAMPTZ NOT NULL DEFAULT now(),
  mode             TEXT NOT NULL CHECK (mode IN ('walk','wheelchair','van','multi')),
  gender           gender_enum NOT NULL,
  floor            SMALLINT CHECK (floor IN (0,-1)),
  origin_type      TEXT,
  destination_type TEXT,
  distance_m       NUMERIC(10,2),
  duration_s       NUMERIC(10,2),
  ok               BOOLEAN NOT NULL DEFAULT TRUE,
  meta             JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS route_logs_ts_idx ON route_logs (ts);
CREATE INDEX IF NOT EXISTS route_logs_ok_idx ON route_logs (ok);

-- =========================================
-- 10) محدودیت‌های موقت ادمین (فضایی/هدف‌دار)
-- =========================================
CREATE TABLE IF NOT EXISTS admin_restrictions (
  id             BIGSERIAL PRIMARY KEY,
  target_table   TEXT CHECK (target_table IN ('areas','doors')),
  target_id      BIGINT,
  geom           geometry(MultiPolygon, 32640),
  floor          SMALLINT CHECK (floor IN (0,-1)),
  restrict_type  TEXT NOT NULL DEFAULT 'close' CHECK (restrict_type IN ('close','penalty')),
  penalty_w      NUMERIC(10,4) DEFAULT 5.0,
  gender         gender_enum NOT NULL DEFAULT 'both',
  modes          TEXT[] NOT NULL DEFAULT ARRAY['walk','wheelchair','van'],
  starts_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at        TIMESTAMPTZ,
  schedule       JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason         TEXT,
  created_by     TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_restrictions_time_idx
  ON admin_restrictions (is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS admin_restrictions_floor_idx
  ON admin_restrictions (floor);
CREATE INDEX IF NOT EXISTS admin_restrictions_target_idx
  ON admin_restrictions (target_table, target_id);
CREATE INDEX IF NOT EXISTS admin_restrictions_geom_gix
  ON admin_restrictions USING GIST (geom);

-- Touch trigger
CREATE OR REPLACE FUNCTION _ar_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ar_touch_updated_at') THEN
    CREATE TRIGGER trg_ar_touch_updated_at
    BEFORE UPDATE ON admin_restrictions
    FOR EACH ROW EXECUTE FUNCTION _ar_touch_updated_at();
  END IF;
END$$;

-- =========================================
-- 11) فانکشن‌های محدودیت ادمین
-- =========================================
-- زمان فعال بودن
CREATE OR REPLACE FUNCTION fn_ar_time_active(p_starts_at TIMESTAMPTZ,
                                             p_ends_at   TIMESTAMPTZ,
                                             p_now       TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE sql
AS $$
  SELECT (p_now >= p_starts_at) AND (p_ends_at IS NULL OR p_now <= p_ends_at);
$$;

-- لیست محدودیت‌های فعال با فیلترهای زمان/جنسیت/مد/طبقه
CREATE OR REPLACE FUNCTION fn_admin_restrictions_active(
  p_now    TIMESTAMPTZ,
  p_gender gender_enum,
  p_mode   TEXT,
  p_floor  SMALLINT
) RETURNS TABLE (
  id BIGINT,
  target_table TEXT,
  target_id BIGINT,
  geom geometry(MultiPolygon, 32640),
  restrict_type TEXT,
  penalty_w NUMERIC,
  floor SMALLINT
)
LANGUAGE sql
AS $$
  SELECT ar.id, ar.target_table, ar.target_id, ar.geom, ar.restrict_type, ar.penalty_w, ar.floor
  FROM admin_restrictions ar
  WHERE ar.is_active = TRUE
    AND fn_ar_time_active(ar.starts_at, ar.ends_at, p_now)
    AND (ar.gender = 'both' OR ar.gender = p_gender)
    AND (p_mode = ANY (ar.modes))
    AND (ar.floor IS NULL OR ar.floor = p_floor);
$$;

-- درب‌های مسدود/دارای پنالتی از دید ادمین
CREATE OR REPLACE FUNCTION fn_blocked_doors_from_admin(
  p_now    TIMESTAMPTZ,
  p_gender gender_enum,
  p_mode   TEXT,
  p_floor  SMALLINT
) RETURNS TABLE (
  door_id BIGINT,
  restrict_type TEXT,
  penalty_w NUMERIC
)
LANGUAGE sql
AS $$
  WITH act AS (
    SELECT * FROM fn_admin_restrictions_active(p_now, p_gender, p_mode, p_floor)
  ),
  direct AS (
    SELECT d.id AS door_id, a.restrict_type, a.penalty_w
    FROM act a
    JOIN doors d ON a.target_table = 'doors' AND a.target_id = d.id
  ),
  spatial AS (
    SELECT d.id AS door_id, a.restrict_type, a.penalty_w
    FROM act a
    JOIN doors d ON (a.target_table IS NULL OR a.target_table = 'doors')
    WHERE a.geom IS NOT NULL
      AND d.floor = p_floor
      AND ST_Intersects(d.geom, a.geom)
  )
  SELECT door_id, restrict_type, penalty_w FROM direct
  UNION
  SELECT door_id, restrict_type, penalty_w FROM spatial;
$$;

-- ناحیه‌های مسدود/دارای پنالتی از دید ادمین
CREATE OR REPLACE FUNCTION fn_blocked_areas_from_admin(
  p_now    TIMESTAMPTZ,
  p_gender gender_enum,
  p_mode   TEXT,
  p_floor  SMALLINT
) RETURNS TABLE (
  area_id BIGINT,
  restrict_type TEXT,
  penalty_w NUMERIC
)
LANGUAGE sql
AS $$
  WITH act AS (
    SELECT * FROM fn_admin_restrictions_active(p_now, p_gender, p_mode, p_floor)
  ),
  direct AS (
    SELECT a2.id AS area_id, a.restrict_type, a.penalty_w
    FROM act a
    JOIN areas a2 ON a.target_table = 'areas' AND a.target_id = a2.id
  ),
  spatial AS (
    SELECT a2.id AS area_id, a.restrict_type, a.penalty_w
    FROM act a
    JOIN areas a2 ON (a.target_table IS NULL OR a.target_table = 'areas')
    WHERE a.geom IS NOT NULL
      AND a2.floor = p_floor
      AND ST_Intersects(a2.geom, a.geom)
  )
  SELECT area_id, restrict_type, penalty_w FROM direct
  UNION
  SELECT area_id, restrict_type, penalty_w FROM spatial;
$$;

-- =========================================
-- 12) توابع Allowed برای موتور مسیر (ست‌برگردان)
-- =========================================
-- Doors: با درنظر گرفتن پنالتی/بستن ادمین
CREATE OR REPLACE FUNCTION fn_allowed_doors(
  p_now    TIMESTAMPTZ,
  p_gender gender_enum,
  p_mode   TEXT,
  p_floor  SMALLINT
) RETURNS TABLE (
  id BIGINT,
  geom geometry(LineString, 32640),
  from_area BIGINT,
  to_area   BIGINT,
  floor SMALLINT,
  allowed_gender gender_enum,
  is_open BOOLEAN,
  modes TEXT[],
  bidirectional BOOLEAN,
  attrs JSONB,
  is_allowed BOOLEAN,
  admin_penalty_w NUMERIC
)
LANGUAGE sql
AS $$
  WITH blocked AS (
    SELECT bd.door_id, bd.restrict_type, bd.penalty_w
    FROM fn_blocked_doors_from_admin(p_now, p_gender, p_mode, p_floor) bd
  )
  SELECT
    d.id, d.geom, d.from_area, d.to_area, d.floor, d.allowed_gender,
    d.is_open, d.modes, d.bidirectional, d.attrs,
    CASE
      WHEN b.door_id IS NULL THEN TRUE
      WHEN b.restrict_type = 'close' THEN FALSE
      ELSE d.is_open
    END AS is_allowed,
    COALESCE(b.penalty_w, 0.0) AS admin_penalty_w
  FROM doors d
  LEFT JOIN blocked b ON b.door_id = d.id
  WHERE d.floor = p_floor
    AND (d.allowed_gender = 'both' OR d.allowed_gender = p_gender)
    AND (p_mode = ANY(d.modes));
$$;

-- Areas: با درنظر گرفتن پنالتی/بستن ادمین
CREATE OR REPLACE FUNCTION fn_allowed_areas(
  p_now    TIMESTAMPTZ,
  p_gender gender_enum,
  p_mode   TEXT,
  p_floor  SMALLINT
) RETURNS TABLE (
  id BIGINT,
  geom geometry(MultiPolygon, 32640),
  area_type area_type_enum,
  floor SMALLINT,
  allowed_gender gender_enum,
  is_closed BOOLEAN,
  weight_open_space NUMERIC,
  attrs JSONB,
  is_allowed BOOLEAN,
  admin_penalty_w NUMERIC
)
LANGUAGE sql
AS $$
  WITH blocked AS (
    SELECT ba.area_id, ba.restrict_type, ba.penalty_w
    FROM fn_blocked_areas_from_admin(p_now, p_gender, p_mode, p_floor) ba
  )
  SELECT
    a.id, a.geom, a.area_type, a.floor, a.allowed_gender, a.is_closed,
    a.weight_open_space, a.attrs,
    CASE
      WHEN b.area_id IS NULL THEN (NOT a.is_closed)
      WHEN b.restrict_type = 'close' THEN FALSE
      ELSE (NOT a.is_closed)
    END AS is_allowed,
    COALESCE(b.penalty_w, 0.0) AS admin_penalty_w
  FROM areas a
  LEFT JOIN blocked b ON b.area_id = a.id
  WHERE a.floor = p_floor
    AND (a.allowed_gender = 'both' OR a.allowed_gender = p_gender);
$$;

-- =========================================
-- 13) ویوهای پیش‌فرض برای تست سریع (پارامتر ثابت)
--     در اجرا/محیط واقعی از توابع fn_allowed_* با پارامترهای درخواست استفاده کنید.
-- =========================================
DROP VIEW IF EXISTS v_allowed_doors;

CREATE OR REPLACE VIEW v_allowed_doors AS
SELECT *
FROM fn_allowed_doors(
  now(),                  -- TIMESTAMPTZ
  'male'::gender_enum,    -- gender_enum
  'walk'::text,           -- TEXT
  0::smallint             -- SMALLINT
);


DROP VIEW IF EXISTS v_allowed_areas;

CREATE OR REPLACE VIEW v_allowed_areas AS
SELECT *
FROM fn_allowed_areas(
  now(),                  -- TIMESTAMPTZ
  'male'::gender_enum,    -- gender_enum
  'walk'::text,           -- TEXT
  0::smallint             -- SMALLINT
);



-- =====================================================
-- 6) جدول نگاشت Feature Group Mappings
-- =====================================================
CREATE TABLE IF NOT EXISTS feature_group_mappings (
  id BIGSERIAL PRIMARY KEY,

  entity_table TEXT NOT NULL CHECK (
    entity_table IN ('areas','doors','poi_points','van_nodes','qrcodes','categories')
  ),

  feature_key TEXT NOT NULL,

  -- اتصال به دسته‌بندی چندسطحی
  category_leaf_id BIGINT,

  default_group TEXT NOT NULL,
  default_subgroup TEXT NOT NULL,
  default_node_function TEXT NOT NULL,

  default_types TEXT[] NOT NULL DEFAULT '{}'::text[],
  default_transport_modes TEXT[] NOT NULL DEFAULT '{}'::text[],

  default_services JSONB NOT NULL DEFAULT '{}'::jsonb,

  default_gender TEXT NOT NULL DEFAULT 'family',

  CONSTRAINT feature_group_mappings_category_leaf_fk
    FOREIGN KEY (category_leaf_id) REFERENCES categories(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS feature_group_mappings_uq
  ON feature_group_mappings(entity_table, feature_key);

CREATE INDEX IF NOT EXISTS feature_group_mappings_cat_leaf_idx
  ON feature_group_mappings(category_leaf_id);




-- =====================================================
-- 7) تابع تجمیعی fn_map_features (جدید)
-- =====================================================
CREATE OR REPLACE FUNCTION public.fn_map_features(p_lang public.lang_enum)
RETURNS TABLE(
  entity_table      text,
  entity_id         int8,
  geom_4326         public.geometry,
  floor             int2,
  name              text,
  description       text,
  "group"           text,
  "subGroup"        text,
  "subGroupValue"   text,
  category_level3   text,
  category_level4   text,
  category_level5   text,
  category_leaf     text,
  types             _text,
  services          jsonb,
  gender            text,
  nodefunction      text,
  restrictedtimes   jsonb,
  latitude          float8,
  longitude         float8,
  gpsmeta           jsonb,
  "timestamp"       timestamptz,
  transportmodes    _text
) AS
$BODY$
  -- ========== 1) POI ها ==========
  SELECT
    'poi_points'::text AS entity_table,
    p.id               AS entity_id,
    ST_Transform(p.geom, 4326) AS geom_4326,
    p.floor,
    fn_i18n_label('poi_points', p.id, 'name', p_lang, 'fa') AS name,
    fn_i18n_label('poi_points', p.id, 'desc', p_lang, 'fa') AS description,

    COALESCE(
      p.attrs->>'group',
      cat.level1_code,
      m.default_group,
      'poi'
    ) AS "group",

    COALESCE(
      p.attrs->>'sub_group',
      cat.level2_code,
      m.default_subgroup,
      p.poi_type::text
    ) AS "subGroup",

    COALESCE(
      p.attrs->>'sub_group_value',
      cat.leaf_code,
      'poi-' || p.id
    ) AS "subGroupValue",

    cat.level3_code AS category_level3,
    cat.level4_code AS category_level4,
    cat.level5_code AS category_level5,
    cat.leaf_code   AS category_leaf,

    COALESCE(
      ARRAY(
        SELECT jsonb_array_elements_text(p.attrs->'types')
      ),
      m.default_types,
      ARRAY[]::text[]
    ) AS types,

    COALESCE(
      p.attrs->'services',
      m.default_services,
      '{}'::jsonb
    ) AS services,

    CASE
      WHEN p.attrs ? 'gender' THEN
        CASE p.attrs->>'gender'
          WHEN 'male'   THEN 'male'
          WHEN 'female' THEN 'female'
          ELSE 'family'
        END
      WHEN m.default_gender IS NOT NULL THEN m.default_gender
      ELSE 'family'
    END AS gender,

    COALESCE(
      p.attrs->>'nodeFunction',
      m.default_node_function,
      'poi'
    ) AS nodeFunction,

    COALESCE(
      p.attrs->'restrictedTimes',
      '[]'::jsonb
    ) AS restrictedTimes,

    ST_Y(ST_Transform(p.geom, 4326)) AS latitude,
    ST_X(ST_Transform(p.geom, 4326)) AS longitude,

    p.attrs->'gpsMeta' AS gpsMeta,

    now() AS "timestamp",

    COALESCE(
      ARRAY(
        SELECT jsonb_array_elements_text(p.attrs->'transportModes')
      ),
      m.default_transport_modes,
      ARRAY[]::text[]
    ) AS transportModes

  FROM poi_points p
  LEFT JOIN feature_group_mappings m
    ON m.entity_table = 'poi_points'
   AND m.feature_key  = p.poi_type::text
  LEFT JOIN categories c_leaf
    ON c_leaf.id = m.category_leaf_id
  LEFT JOIN LATERAL fn_category_path(c_leaf.id) cat
    ON TRUE

  UNION ALL

  -- ========== 2) درب‌ها ==========
  SELECT
    'doors'::text AS entity_table,
    d.id          AS entity_id,
    ST_Transform(ST_LineInterpolatePoint(d.geom, 0.5), 4326) AS geom_4326,
    d.floor,
    fn_i18n_label('doors', d.id, 'name', p_lang, 'fa') AS name,
    fn_i18n_label('doors', d.id, 'desc', p_lang, 'fa') AS description,

    COALESCE(
      d.attrs->>'group',
      cat.level1_code,
      m.default_group,
      'connection'
    ) AS "group",

    COALESCE(
      d.attrs->>'sub_group',
      cat.level2_code,
      m.default_subgroup,
      'door'
    ) AS "subGroup",

    COALESCE(
      d.attrs->>'sub_group_value',
      cat.leaf_code,
      'door-' || d.id
    ) AS "subGroupValue",

    cat.level3_code AS category_level3,
    cat.level4_code AS category_level4,
    cat.level5_code AS category_level5,
    cat.leaf_code   AS category_leaf,

    COALESCE(
      ARRAY(
        SELECT jsonb_array_elements_text(d.attrs->'types')
      ),
      m.default_types,
      ARRAY['door']::text[]
    ) AS types,

    jsonb_build_object(
      'wheelchair',   'wheelchair' = ANY (d.modes),
      'electricVan',  'van'        = ANY (d.modes),
      'walking',      'walk'       = ANY (d.modes)
    ) AS services,

    COALESCE(
      CASE d.allowed_gender
        WHEN 'male'   THEN 'male'
        WHEN 'female' THEN 'female'
        ELSE 'family'
      END,
      m.default_gender,
      'family'
    ) AS gender,

    COALESCE(
      d.attrs->>'nodeFunction',
      m.default_node_function,
      'door'
    ) AS nodeFunction,

    COALESCE(
      d.attrs->'restrictedTimes',
      '[]'::jsonb
    ) AS restrictedTimes,

    ST_Y(ST_Transform(ST_LineInterpolatePoint(d.geom, 0.5), 4326)) AS latitude,
    ST_X(ST_Transform(ST_LineInterpolatePoint(d.geom, 0.5), 4326)) AS longitude,

    d.attrs->'gpsMeta' AS gpsMeta,

    now() AS "timestamp",

    d.modes AS transportModes

  FROM doors d
  LEFT JOIN feature_group_mappings m
    ON m.entity_table = 'doors'
   AND m.feature_key  = 'door'
  LEFT JOIN categories c_leaf
    ON c_leaf.id = m.category_leaf_id
  LEFT JOIN LATERAL fn_category_path(c_leaf.id) cat
    ON TRUE

  UNION ALL

  -- ========== 3) Areas (با استفاده از areas_simplified) ==========
  SELECT
    'areas'::text AS entity_table,
    a.id          AS entity_id,
    ST_Transform(COALESCE(s.geom, a.geom), 4326) AS geom_4326,
    a.floor,
    fn_i18n_label('areas', a.id, 'name', p_lang, 'fa') AS name,
    fn_i18n_label('areas', a.id, 'desc', p_lang, 'fa') AS description,

    COALESCE(
      a.attrs->>'group',
      cat.level1_code,
      m.default_group,
      CASE a.area_type
        WHEN 'courtyard'     THEN 'sahn'
        WHEN 'riwaq'         THEN 'riwaq'
        WHEN 'iwan'          THEN 'iwan'
        WHEN 'mosque'        THEN 'mosque'
        WHEN 'elevator_area' THEN 'vertical'
        WHEN 'stair_area'    THEN 'vertical'
        WHEN 'ramp_area'     THEN 'vertical'
        WHEN 'admin_zone'    THEN 'admin'
        ELSE 'area'
      END,
      'area'
    ) AS "group",

    COALESCE(
      a.attrs->>'sub_group',
      cat.level2_code,
      m.default_subgroup,
      fn_i18n_label('areas', a.id, 'name', p_lang, 'fa')
    ) AS "subGroup",

    COALESCE(
      a.attrs->>'sub_group_value',
      cat.leaf_code,
      'area-' || a.id
    ) AS "subGroupValue",

    cat.level3_code AS category_level3,
    cat.level4_code AS category_level4,
    cat.level5_code AS category_level5,
    cat.leaf_code   AS category_leaf,

    COALESCE(
      ARRAY(
        SELECT jsonb_array_elements_text(a.attrs->'types')
      ),
      m.default_types,
      ARRAY[a.area_type::text]
    ) AS types,

    COALESCE(
      a.attrs->'services',
      m.default_services,
      '{}'::jsonb
    ) AS services,

    COALESCE(
      CASE a.allowed_gender
        WHEN 'male'   THEN 'male'
        WHEN 'female' THEN 'female'
        ELSE 'family'
      END,
      m.default_gender,
      'family'
    ) AS gender,

    COALESCE(
      a.attrs->>'nodeFunction',
      m.default_node_function,
      'area'
    ) AS nodeFunction,

    COALESCE(
      a.attrs->'restrictedTimes',
      '[]'::jsonb
    ) AS restrictedTimes,

    ST_Y(
      ST_Centroid(
        ST_Transform(COALESCE(s.geom, a.geom), 4326)
      )
    ) AS latitude,
    ST_X(
      ST_Centroid(
        ST_Transform(COALESCE(s.geom, a.geom), 4326)
      )
    ) AS longitude,

    a.attrs->'gpsMeta' AS gpsMeta,

    now() AS "timestamp",

    COALESCE(
      ARRAY(
        SELECT jsonb_array_elements_text(a.attrs->'transportModes')
      ),
      m.default_transport_modes,
      ARRAY[]::text[]
    ) AS transportModes

  FROM areas a
  LEFT JOIN areas_simplified s
    ON s.id = a.id
  LEFT JOIN feature_group_mappings m
    ON m.entity_table = 'areas'
   AND m.feature_key  = a.area_type::text
  LEFT JOIN categories c_leaf
    ON c_leaf.id = m.category_leaf_id
  LEFT JOIN LATERAL fn_category_path(c_leaf.id) cat
    ON TRUE

  UNION ALL

  -- ========== 4) Van nodes ==========
  SELECT
    'van_nodes'::text AS entity_table,
    v.id              AS entity_id,
    ST_Transform(v.geom, 4326) AS geom_4326,
    v.floor,
    fn_i18n_label('van_nodes', v.id, 'name', p_lang, 'fa') AS name,
    fn_i18n_label('van_nodes', v.id, 'desc', p_lang, 'fa') AS description,

    COALESCE(
      cat.level1_code,
      m.default_group,
      'van'
    ) AS "group",

    COALESCE(
      cat.level2_code,
      m.default_subgroup,
      CASE v.node_type
        WHEN 'stop'     THEN 'van-stop'
        WHEN 'junction' THEN 'van-junction'
        ELSE 'van-node'
      END
    ) AS "subGroup",

    COALESCE(
      cat.leaf_code,
      ('van-node-' || v.id)::text
    ) AS "subGroupValue",

    cat.level3_code AS category_level3,
    cat.level4_code AS category_level4,
    cat.level5_code AS category_level5,
    cat.leaf_code   AS category_leaf,

    COALESCE(
      m.default_types,
      ARRAY[v.node_type::text]
    ) AS types,

    COALESCE(
      m.default_services,
      jsonb_build_object(
        'wheelchair',   true,
        'electricVan',  (v.node_type = 'stop'),
        'walking',      true
      )
    ) AS services,

    COALESCE(
      m.default_gender,
      'family'
    ) AS gender,

    COALESCE(
      m.default_node_function,
      'van_node'
    ) AS nodeFunction,

    '[]'::jsonb AS restrictedTimes,

    ST_Y(ST_Transform(v.geom, 4326)) AS latitude,
    ST_X(ST_Transform(v.geom, 4326)) AS longitude,

    NULL::jsonb AS gpsMeta,

    now() AS "timestamp",

    COALESCE(
      m.default_transport_modes,
      ARRAY['van']::text[]
    ) AS transportModes

  FROM van_nodes v
  LEFT JOIN feature_group_mappings m
    ON m.entity_table = 'van_nodes'
   AND m.feature_key  = v.node_type::text
  LEFT JOIN categories c_leaf
    ON c_leaf.id = m.category_leaf_id
  LEFT JOIN LATERAL fn_category_path(c_leaf.id) cat
    ON TRUE

  UNION ALL

  -- ========== 5) QR codes ==========
  SELECT
    'qrcodes'::text AS entity_table,
    q.id            AS entity_id,
    ST_Transform(q.geom, 4326) AS geom_4326,
    COALESCE((q.attrs->>'floor')::smallint, 0) AS floor,

    fn_i18n_label('qrcodes', q.id, 'name', p_lang, 'fa') AS name,
    fn_i18n_label('qrcodes', q.id, 'desc', p_lang, 'fa') AS description,

    COALESCE(
      q.attrs->>'group',
      cat.level1_code,
      m.default_group,
      'qrcode'
    ) AS "group",

    COALESCE(
      q.attrs->>'sub_group',
      cat.level2_code,
      m.default_subgroup,
      q.target_type::text
    ) AS "subGroup",

    COALESCE(
      q.attrs->>'sub_group_value',
      cat.leaf_code,
      q.code
    ) AS "subGroupValue",

    cat.level3_code AS category_level3,
    cat.level4_code AS category_level4,
    cat.level5_code AS category_level5,
    cat.leaf_code   AS category_leaf,

    COALESCE(
      ARRAY(
        SELECT jsonb_array_elements_text(q.attrs->'types')
      ),
      m.default_types,
      ARRAY[q.target_type::text]
    ) AS types,

    COALESCE(
      q.attrs->'services',
      m.default_services,
      '{}'::jsonb
    ) AS services,

    CASE
      WHEN q.attrs ? 'gender' THEN
        CASE q.attrs->>'gender'
          WHEN 'male'   THEN 'male'
          WHEN 'female' THEN 'female'
          ELSE 'family'
        END
      WHEN m.default_gender IS NOT NULL THEN m.default_gender
      ELSE 'family'
    END AS gender,

    COALESCE(
      q.attrs->>'nodeFunction',
      m.default_node_function,
      'qrcode'
    ) AS nodeFunction,

    COALESCE(
      q.attrs->'restrictedTimes',
      '[]'::jsonb
    ) AS restrictedTimes,

    ST_Y(ST_Transform(q.geom, 4326)) AS latitude,
    ST_X(ST_Transform(q.geom, 4326)) AS longitude,

    q.attrs->'gpsMeta' AS gpsMeta,

    now() AS "timestamp",

    COALESCE(
      ARRAY(
        SELECT jsonb_array_elements_text(q.attrs->'transportModes')
      ),
      m.default_transport_modes,
      ARRAY[]::text[]
    ) AS transportModes

  FROM qrcodes q
  LEFT JOIN feature_group_mappings m
    ON m.entity_table = 'qrcodes'
   AND m.feature_key  = q.target_type::text
  LEFT JOIN categories c_leaf
    ON c_leaf.id = m.category_leaf_id
  LEFT JOIN LATERAL fn_category_path(c_leaf.id) cat
    ON TRUE
$BODY$
LANGUAGE sql
VOLATILE
COST 100
ROWS 1000;


-- =====================================================
-- 1) جدول دسته‌بندی چندسطحی (تا ۵ سطح)
-- =====================================================

CREATE TABLE IF NOT EXISTS categories (
  id              BIGSERIAL PRIMARY KEY,
  code            TEXT NOT NULL,           -- دیگه اینجا UNIQUE نمی‌ذاریم
  label_key       TEXT,
  property_target TEXT NOT NULL,           -- 'group' یا 'subGroup' یا ...
  icon            TEXT,
  parent_id       BIGINT REFERENCES categories(id) ON DELETE RESTRICT,
  level           SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 5),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (
    (parent_id IS NULL AND level = 1) OR
    (parent_id IS NOT NULL AND level > 1)
  )
);

-- یکتایی روی ترکیب (code + property_target + parent_id) برای تمایز درختی
CREATE UNIQUE INDEX IF NOT EXISTS categories_code_prop_parent_uq
  ON categories (code, property_target, COALESCE(parent_id, 0));


-- =====================================================
-- 8) تابع fn_map_geojson (FeatureCollection)
-- =====================================================
CREATE OR REPLACE FUNCTION fn_map_geojson(p_lang  lang_enum, p_floor smallint) 
RETURNS JSONB
LANGUAGE sql
AS $$
  WITH feats AS (
    SELECT
      'Feature' AS type,
      ST_AsGeoJSON(f.geom_4326)::jsonb AS geometry,
      jsonb_build_object(
        'id',             f.entity_table || '-' || f.entity_id,
        'name',           f.name,
        'description',    f.description,
        "group",          f."group",
        "subGroup",       f."subGroup",
        "subGroupValue",  f."subGroupValue",
        'types',          f.types,
        'services',       f.services,
        'gender',         f.gender,
        'nodeFunction',   f.nodeFunction,
        'restrictedTimes',f.restrictedTimes,
        'latitude',       f.latitude,
        'longitude',      f.longitude,
        'gpsMeta',        f.gpsMeta,
        'timestamp',      f."timestamp",
        'transportModes', f.transportModes,
        'floor',          f.floor
      ) AS properties
    FROM fn_map_features(p_lang) f
    WHERE f.floor = p_floor
  )
  SELECT jsonb_build_object(
    'type',     'FeatureCollection',
    'features', COALESCE(jsonb_agg(to_jsonb(feats)), '[]'::jsonb)
  )
  FROM feats;
$$;

-- =====================================================
-- 8) جدول ژنومتری های ساده سازی شده برای area
-- =====================================================
CREATE TABLE IF NOT EXISTS areas_simplified (
  id        BIGINT PRIMARY KEY REFERENCES areas(id) ON DELETE CASCADE,
  geom      geometry(MultiPolygon, 32640) NOT NULL
);


-- =====================================================
-- این تابع برای یک category_leaf_id مسیر را به‌صورت ۵ ستون برمی‌گرداند:
-- =====================================================
CREATE OR REPLACE FUNCTION fn_category_path(p_leaf_id BIGINT)
RETURNS TABLE (
  level1_id   BIGINT, level1_code TEXT,
  level2_id   BIGINT, level2_code TEXT,
  level3_id   BIGINT, level3_code TEXT,
  level4_id   BIGINT, level4_code TEXT,
  level5_id   BIGINT, level5_code TEXT,
  leaf_id     BIGINT, leaf_code   TEXT
)
LANGUAGE sql
STABLE
AS $$
WITH RECURSIVE cte AS (
  SELECT c.id, c.code, c.parent_id, c.level
  FROM   categories c
  WHERE  c.id = p_leaf_id

  UNION ALL

  SELECT p.id, p.code, p.parent_id, p.level
  FROM   categories p
  JOIN   cte ON p.id = cte.parent_id
)
SELECT
  MAX(CASE WHEN level = 1 THEN id   END) AS level1_id,
  MAX(CASE WHEN level = 1 THEN code END) AS level1_code,

  MAX(CASE WHEN level = 2 THEN id   END) AS level2_id,
  MAX(CASE WHEN level = 2 THEN code END) AS level2_code,

  MAX(CASE WHEN level = 3 THEN id   END) AS level3_id,
  MAX(CASE WHEN level = 3 THEN code END) AS level3_code,

  MAX(CASE WHEN level = 4 THEN id   END) AS level4_id,
  MAX(CASE WHEN level = 4 THEN code END) AS level4_code,

  MAX(CASE WHEN level = 5 THEN id   END) AS level5_id,
  MAX(CASE WHEN level = 5 THEN code END) AS level5_code,

  MAX(id)   AS leaf_id,
  MAX(code) AS leaf_code
FROM cte;
$$;


-- function layer fn_map_features_mvt
CREATE OR REPLACE FUNCTION public.fn_map_features_mvt(
  z                 integer,
  x                 integer,
  y                 integer,
  p_lang            public.lang_enum DEFAULT 'fa',
  p_floor           smallint         DEFAULT NULL,
  p_gender          text             DEFAULT NULL,
  p_entity_tables   text             DEFAULT NULL  -- مثل 'areas,doors'
)
RETURNS bytea
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  tile_bbox_3857   geometry;
  tile_bbox_4326   geometry;
  v_entity_tables  text[];
BEGIN
  -- BBOX tile در WebMercator
  tile_bbox_3857 := ST_TileEnvelope(z, x, y);
  tile_bbox_4326 := ST_Transform(tile_bbox_3857, 4326);

  -- لیست لایه‌ها (entity_table) اگر داده شده
  IF p_entity_tables IS NOT NULL AND p_entity_tables <> '' THEN
    v_entity_tables := string_to_array(p_entity_tables, ',');
  ELSE
    v_entity_tables := NULL;
  END IF;

  RETURN (
    SELECT ST_AsMVT(tile, 'map_features', 4096, 'geom')
    FROM (
      SELECT
        ST_AsMVTGeom(
          ST_Transform(f.geom_4326, 3857),
          tile_bbox_3857,
          4096,
          64,
          true
        ) AS geom,

        f.entity_table,
        f.entity_id,
        f.floor,
        f.name,
        f.description,
        f."group",
        f."subGroup",
        f."subGroupValue",
        f.category_level3,
        f.category_level4,
        f.category_level5,
        f.category_leaf,
        f.types,
        f.services,
        f.gender,
        f.nodefunction,
        f.restrictedtimes,
        f.latitude,
        f.longitude,
        f.gpsmeta,
        f."timestamp",
        f.transportmodes

      FROM public.fn_map_features(p_lang) AS f
      WHERE
        f.geom_4326 IS NOT NULL
        AND ST_Intersects(f.geom_4326, tile_bbox_4326)
        AND (p_floor  IS NULL OR f.floor  = p_floor)
        AND (p_gender IS NULL OR f.gender = p_gender)
        AND (v_entity_tables IS NULL OR f.entity_table = ANY (v_entity_tables))
    ) AS tile
    WHERE geom IS NOT NULL
  );
END;
$$;

---- function layer areas_mvt
CREATE OR REPLACE FUNCTION public.fn_areas_mvt(
  z integer,
  x integer,
  y integer,
  p_floor smallint DEFAULT NULL
)
RETURNS bytea
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  tile_bbox_3857 geometry;
  tile_bbox_4326 geometry;
BEGIN
  tile_bbox_3857 := ST_TileEnvelope(z, x, y);
  tile_bbox_4326 := ST_Transform(tile_bbox_3857, 4326);

  RETURN (
    SELECT ST_AsMVT(t, 'areas', 4096, 'geom')
    FROM (
      SELECT
        ST_AsMVTGeom(
          ST_Transform(a.geom, 3857),
          tile_bbox_3857,
          4096,
          64,
          true
        ) AS geom,
        a.id,
        a.area_type,
        a.floor,
        a.allowed_gender,
        a.is_closed,
        a.weight_open_space,
        a.attrs
      FROM areas a
      WHERE ST_Intersects(ST_Transform(a.geom, 4326), tile_bbox_4326)
        AND (p_floor IS NULL OR a.floor = p_floor)
    ) AS t
    WHERE geom IS NOT NULL
  );
END;
$$;
