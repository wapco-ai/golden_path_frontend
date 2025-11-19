-- =====================================================
-- 9) Seed اولیه feature_group_mappings
-- =====================================================

-- ===== AREAS =====
INSERT INTO feature_group_mappings (
  entity_table, feature_key,
  default_group, default_subgroup,
  default_node_function, default_types,
  default_transport_modes, default_services, default_gender
) VALUES
('areas', 'courtyard',
 'sahn', 'courtyard',
 'area',
 ARRAY['courtyard'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),
('areas', 'riwaq',
 'riwaq', 'riwaq',
 'area',
 ARRAY['riwaq'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),
('areas', 'iwan',
 'iwan', 'iwan',
 'area',
 ARRAY['iwan'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),
('areas', 'mosque',
 'mosque', 'mosque',
 'area',
 ARRAY['mosque'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),
('areas', 'elevator_area',
 'vertical', 'elevator_area',
 'area',
 ARRAY['vertical','elevator_area'],
 ARRAY['walk','wheelchair'],
 '{"walking": true, "wheelchair": true}'::jsonb,
 'family'),
('areas', 'stair_area',
 'vertical', 'stair_area',
 'area',
 ARRAY['vertical','stair_area'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),
('areas', 'ramp_area',
 'vertical', 'ramp_area',
 'area',
 ARRAY['vertical','ramp_area'],
 ARRAY['walk','wheelchair'],
 '{"walking": true, "wheelchair": true}'::jsonb,
 'family'),
('areas', 'admin_zone',
 'admin', 'admin_zone',
 'area',
 ARRAY['admin_zone'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family')
ON CONFLICT (entity_table, feature_key) DO NOTHING;

-- ===== DOORS =====
INSERT INTO feature_group_mappings (
  entity_table, feature_key,
  default_group, default_subgroup,
  default_node_function, default_types,
  default_transport_modes, default_services, default_gender
) VALUES
('doors', 'door',
 'connection', 'door',
 'door',
 ARRAY['door'],
 ARRAY['walk','wheelchair','van'],
 '{"walking": true, "wheelchair": true, "electricVan": true}'::jsonb,
 'family')
ON CONFLICT (entity_table, feature_key) DO NOTHING;

-- ===== POI_POINTS =====
INSERT INTO feature_group_mappings (
  entity_table, feature_key,
  default_group, default_subgroup,
  default_node_function, default_types,
  default_transport_modes, default_services, default_gender
) VALUES
('poi_points', 'wc',
 'service', 'wc',
 'poi',
 ARRAY['wc','toilet'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),
('poi_points', 'elevator',
 'vertical', 'elevator',
 'poi',
 ARRAY['elevator','vertical'],
 ARRAY['walk','wheelchair'],
 '{"walking": true, "wheelchair": true}'::jsonb,
 'family'),
('poi_points', 'stair',
 'vertical', 'stair',
 'poi',
 ARRAY['stair','vertical'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),
('poi_points', 'info_desk',
 'service', 'info_desk',
 'poi',
 ARRAY['info','service'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),
('poi_points', 'restaurant',
 'service', 'restaurant',
 'poi',
 ARRAY['food','restaurant'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),
('poi_points', 'shop',
 'service', 'shop',
 'poi',
 ARRAY['shop','store'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),
('poi_points', 'wheelchair_storage',
 'service', 'wheelchair_storage',
 'poi',
 ARRAY['wheelchair_storage'],
 ARRAY['walk','wheelchair'],
 '{"walking": true, "wheelchair": true}'::jsonb,
 'family')
ON CONFLICT (entity_table, feature_key) DO NOTHING;

-- ===== VAN_NODES =====
INSERT INTO feature_group_mappings (
  entity_table, feature_key,
  default_group, default_subgroup,
  default_node_function, default_types,
  default_transport_modes, default_services, default_gender
) VALUES
('van_nodes', 'stop',
 'van', 'van_stop',
 'van_node',
 ARRAY['stop','van'],
 ARRAY['van','walk'],
 '{"walking": true, "electricVan": true}'::jsonb,
 'family'),
('van_nodes', 'junction',
 'van', 'van_junction',
 'van_node',
 ARRAY['junction','van'],
 ARRAY['van'],
 '{"electricVan": true}'::jsonb,
 'family')
ON CONFLICT (entity_table, feature_key) DO NOTHING;

-- ===== QRCODES =====
INSERT INTO feature_group_mappings (
  entity_table, feature_key,
  default_group, default_subgroup,
  default_node_function, default_types,
  default_transport_modes, default_services, default_gender
) VALUES
('qrcodes', 'area',
 'qrcode', 'qrcode_area',
 'qrcode',
 ARRAY['qrcode','area'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),
('qrcodes', 'poi',
 'qrcode', 'qrcode_poi',
 'qrcode',
 ARRAY['qrcode','poi'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),
('qrcodes', 'door',
 'qrcode', 'qrcode_door',
 'qrcode',
 ARRAY['qrcode','door'],
 ARRAY['walk','wheelchair','van'],
 '{"walking": true, "wheelchair": true, "electricVan": true}'::jsonb,
 'family'),
('qrcodes', 'generic',
 'qrcode', 'qrcode_generic',
 'qrcode',
 ARRAY['qrcode'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family')
ON CONFLICT (entity_table, feature_key) DO NOTHING;




-- سطح ۱: گروه‌ها
INSERT INTO categories (code, label_key, property_target, icon, parent_id, level, sort_order, is_active)
VALUES
  ('sahn',     'groupCourtyardPlural', 'group',       'courtyard', NULL, 1,  10, TRUE),
  ('eyvan',    'groupEyvanPlural',     'group',       'eyvan',     NULL, 1,  20, TRUE),
  ('ravaq',    'groupRavaqPlural',     'group',       'shrine',    NULL, 1,  30, TRUE),
  ('masjed',   'groupMosques',         'group',       'mosque',    NULL, 1,  40, TRUE),
  ('madrese',  'groupSchools',         'group',       'school',    NULL, 1,  50, TRUE),
  ('khadamat', 'groupServices',        'group',       'services',  NULL, 1,  60, TRUE),
  ('elmi',     'groupCulture',         'group',       'culture',   NULL, 1,  70, TRUE),
  ('cemetery', 'groupCemetery',        'group',       'cemetery',  NULL, 1,  80, TRUE),
  ('qrcode',   'groupQRScan',          'nodeFunction','qr-code',   NULL, 1,  90, TRUE),
  ('elevator', 'groupElevator',        'group',       'elevator',  NULL, 1, 100, TRUE),
  ('other',    'groupOther',           'group',       'other',     NULL, 1, 110, TRUE);

-- سطح ۲: زیرگروه‌ها
INSERT INTO categories (code, label_key, property_target, icon, parent_id, level, sort_order, is_active)
VALUES
  -- sahn
  ('sahn-enqelab',      NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'sahn'), 2, 10, TRUE),
  ('sahn-azadi',        NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'sahn'), 2, 20, TRUE),
  ('sahn-jomhouri',     NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'sahn'), 2, 30, TRUE),
  ('sahn-qods',         NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'sahn'), 2, 40, TRUE),
  ('sahn-jame-razavi',  NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'sahn'), 2, 50, TRUE),
  ('sahn-ghadir',       NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'sahn'), 2, 60, TRUE),
  ('sahn-kosar',        NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'sahn'), 2, 70, TRUE),
  ('sahn-emam-hasan',   NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'sahn'), 2, 80, TRUE),
  ('sahn-payambar-azam',NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'sahn'), 2, 90, TRUE),

  -- eyvan
  ('eyvan-abbasi',       NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'eyvan'), 2, 10, TRUE),
  ('eyvan-talayi',       NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'eyvan'), 2, 20, TRUE),
  ('eyvan-saat',         NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'eyvan'), 2, 30, TRUE),
  ('eyvan-naqare',       NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'eyvan'), 2, 40, TRUE),
  ('eyvan-valiasr',      NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'eyvan'), 2, 50, TRUE),
  ('eyvan-talaye-azadi', NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'eyvan'), 2, 60, TRUE),

  -- ravaq
  ('daralhefaz',       NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'ravaq'), 2, 10, TRUE),
  ('daralsiade',       NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'ravaq'), 2, 20, TRUE),
  ('daralsalam',       NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'ravaq'), 2, 30, TRUE),
  ('hatamkhani',       NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'ravaq'), 2, 40, TRUE),
  ('gonbadallahverdi', NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'ravaq'), 2, 50, TRUE),
  ('daralziafe',       NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'ravaq'), 2, 60, TRUE),
  ('tohidkhane',       NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'ravaq'), 2, 70, TRUE),
  ('daralfeyz',        NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'ravaq'), 2, 80, TRUE),
  ('daralsaade',       NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'ravaq'), 2, 90, TRUE),
  ('goharsad',         NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'ravaq'), 2, 100, TRUE),

  -- masjed
  ('balasar', NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'masjed'), 2, 10, TRUE),
  ('goharsad', NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'masjed'), 2, 20, TRUE),

  -- madrese
  ('payeen-khyaban', NULL, 'subGroup', 'school',
    (SELECT id FROM categories WHERE code = 'madrese'), 2, 10, TRUE),
  ('bala-khyaban',   NULL, 'subGroup', 'school',
    (SELECT id FROM categories WHERE code = 'madrese'), 2, 20, TRUE),
  ('navvab',         NULL, 'subGroup', 'school',
    (SELECT id FROM categories WHERE code = 'madrese'), 2, 30, TRUE),
  ('dodar',          NULL, 'subGroup', 'school',
    (SELECT id FROM categories WHERE code = 'madrese'), 2, 40, TRUE),

  -- khadamat
  ('wc',           NULL, 'subGroup', 'services',
    (SELECT id FROM categories WHERE code = 'khadamat'), 2, 10, TRUE),
  ('telephon',     NULL, 'subGroup', 'services',
    (SELECT id FROM categories WHERE code = 'khadamat'), 2, 20, TRUE),
  ('otag-madadjo', NULL, 'subGroup', 'services',
    (SELECT id FROM categories WHERE code = 'khadamat'), 2, 30, TRUE),
  ('namaazkhane',  NULL, 'subGroup', 'services',
    (SELECT id FROM categories WHERE code = 'khadamat'), 2, 40, TRUE),
  ('ketabkhane',   NULL, 'subGroup', 'services',
    (SELECT id FROM categories WHERE code = 'khadamat'), 2, 50, TRUE),
  ('room',         NULL, 'subGroup', 'services',
    (SELECT id FROM categories WHERE code = 'khadamat'), 2, 60, TRUE),

  -- elmi
  ('hoze-elmiye',     NULL, 'subGroup', 'culture',
    (SELECT id FROM categories WHERE code = 'elmi'), 2, 10, TRUE),
  ('markaz-motaleat', NULL, 'subGroup', 'culture',
    (SELECT id FROM categories WHERE code = 'elmi'), 2, 20, TRUE),
  ('uni',             NULL, 'subGroup', 'culture',
    (SELECT id FROM categories WHERE code = 'elmi'), 2, 30, TRUE),

  -- cemetery
  ('cemetery', NULL, 'subGroup', 'cemetery',
    (SELECT id FROM categories WHERE code = 'cemetery'), 2, 10, TRUE),
  ('yadbod',   NULL, 'subGroup', 'cemetery',
    (SELECT id FROM categories WHERE code = 'cemetery'), 2, 20, TRUE),

  -- qrcode
  ('bakhsh-control', NULL, 'subGroup', 'qr-code',
    (SELECT id FROM categories WHERE code = 'qrcode'), 2, 10, TRUE),
  ('cctv',           NULL, 'subGroup', 'qr-code',
    (SELECT id FROM categories WHERE code = 'qrcode'), 2, 20, TRUE),

  -- other
  ('other',        NULL, 'subGroup', 'other',
    (SELECT id FROM categories WHERE code = 'other'), 2, 10, TRUE),
  ('rozemonavare', NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'other'), 2, 20, TRUE),
  ('saghakhaneh',  NULL, 'subGroup', NULL,
    (SELECT id FROM categories WHERE code = 'other'), 2, 30, TRUE);

--- پر کردن جدول ساده سازی پ.لیگون
INSERT INTO areas_simplified (id, geom)
SELECT
  a.id,
  ST_SimplifyPreserveTopology(a.geom, 0.5)  -- عدد 0.5 یعنی حدود نیم متر؛ قابل تنظیم
FROM areas a
ON CONFLICT (id) DO UPDATE
SET geom = EXCLUDED.geom;



-- ===== AREAS =====
INSERT INTO feature_group_mappings (
  entity_table, feature_key,
  category_leaf_id,
  default_group, default_subgroup,
  default_node_function, default_types,
  default_transport_modes, default_services, default_gender
) VALUES
('areas', 'courtyard',
 (SELECT id
    FROM categories
   WHERE code = 'sahn'
     AND property_target = 'group'),
 'sahn', 'courtyard',
 'area',
 ARRAY['courtyard'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),

('areas', 'riwaq',
 (SELECT id
    FROM categories
   WHERE code = 'ravaq'
     AND property_target = 'group'),
 'riwaq', 'riwaq',
 'area',
 ARRAY['riwaq'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),

('areas', 'iwan',
 (SELECT id
    FROM categories
   WHERE code = 'eyvan'
     AND property_target = 'group'),
 'iwan', 'iwan',
 'area',
 ARRAY['iwan'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),

('areas', 'mosque',
 (SELECT id
    FROM categories
   WHERE code = 'masjed'
     AND property_target = 'group'),
 'mosque', 'mosque',
 'area',
 ARRAY['mosque'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),

('areas', 'elevator_area',
 (SELECT id
    FROM categories
   WHERE code = 'elevator'
     AND property_target = 'group'),
 'vertical', 'elevator_area',
 'area',
 ARRAY['vertical','elevator_area'],
 ARRAY['walk','wheelchair'],
 '{"walking": true, "wheelchair": true}'::jsonb,
 'family'),

('areas', 'stair_area',
 (SELECT id
    FROM categories
   WHERE code = 'elevator'
     AND property_target = 'group'),
 'vertical', 'stair_area',
 'area',
 ARRAY['vertical','stair_area'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),

('areas', 'ramp_area',
 (SELECT id
    FROM categories
   WHERE code = 'elevator'
     AND property_target = 'group'),
 'vertical', 'ramp_area',
 'area',
 ARRAY['vertical','ramp_area'],
 ARRAY['walk','wheelchair'],
 '{"walking": true, "wheelchair": true}'::jsonb,
 'family'),

('areas', 'admin_zone',
 (SELECT id
    FROM categories
   WHERE code = 'other'
     AND property_target = 'group'),
 'admin', 'admin_zone',
 'area',
 ARRAY['admin_zone'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family')
ON CONFLICT (entity_table, feature_key) DO UPDATE
SET category_leaf_id        = EXCLUDED.category_leaf_id,
    default_group           = EXCLUDED.default_group,
    default_subgroup        = EXCLUDED.default_subgroup,
    default_node_function   = EXCLUDED.default_node_function,
    default_types           = EXCLUDED.default_types,
    default_transport_modes = EXCLUDED.default_transport_modes,
    default_services        = EXCLUDED.default_services,
    default_gender          = EXCLUDED.default_gender;

-- ===== DOORS =====
INSERT INTO feature_group_mappings (
  entity_table, feature_key,
  category_leaf_id,
  default_group, default_subgroup,
  default_node_function, default_types,
  default_transport_modes, default_services, default_gender
) VALUES
('doors', 'door',
 (SELECT id
    FROM categories
   WHERE code = 'other'
     AND property_target = 'group'),
 'connection', 'door',
 'door',
 ARRAY['door'],
 ARRAY['walk','wheelchair','van'],
 '{"walking": true, "wheelchair": true, "electricVan": true}'::jsonb,
 'family')
ON CONFLICT (entity_table, feature_key) DO UPDATE
SET category_leaf_id        = EXCLUDED.category_leaf_id,
    default_group           = EXCLUDED.default_group,
    default_subgroup        = EXCLUDED.default_subgroup,
    default_node_function   = EXCLUDED.default_node_function,
    default_types           = EXCLUDED.default_types,
    default_transport_modes = EXCLUDED.default_transport_modes,
    default_services        = EXCLUDED.default_services,
    default_gender          = EXCLUDED.default_gender;


-- ===== POI_POINTS =====
INSERT INTO feature_group_mappings (
  entity_table, feature_key,
  category_leaf_id,
  default_group, default_subgroup,
  default_node_function, default_types,
  default_transport_modes, default_services, default_gender
) VALUES
-- WC → khadamat / wc (زیرگروه صریح در md)
('poi_points', 'wc',
 (SELECT c.id
    FROM categories c
    JOIN categories g ON c.parent_id = g.id
   WHERE g.code = 'khadamat'
     AND g.property_target = 'group'
     AND c.code = 'wc'
     AND c.property_target = 'subGroup'),
 'service', 'wc',
 'poi',
 ARRAY['wc','toilet'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),

-- آسانسور و پله‌ها → گروه elevator (بدون زیرگروه در md)
('poi_points', 'elevator',
 (SELECT id
    FROM categories
   WHERE code = 'elevator'
     AND property_target = 'group'),
 'vertical', 'elevator',
 'poi',
 ARRAY['elevator','vertical'],
 ARRAY['walk','wheelchair'],
 '{"walking": true, "wheelchair": true}'::jsonb,
 'family'),

('poi_points', 'stair',
 (SELECT id
    FROM categories
   WHERE code = 'elevator'
     AND property_target = 'group'),
 'vertical', 'stair',
 'poi',
 ARRAY['stair','vertical'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),

-- بقیه‌ی سرویس‌ها → گروه khadamat (سطح ۱)
('poi_points', 'info_desk',
 (SELECT id
    FROM categories
   WHERE code = 'khadamat'
     AND property_target = 'group'),
 'service', 'info_desk',
 'poi',
 ARRAY['info','service'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),

('poi_points', 'restaurant',
 (SELECT id
    FROM categories
   WHERE code = 'khadamat'
     AND property_target = 'group'),
 'service', 'restaurant',
 'poi',
 ARRAY['food','restaurant'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),

('poi_points', 'shop',
 (SELECT id
    FROM categories
   WHERE code = 'khadamat'
     AND property_target = 'group'),
 'service', 'shop',
 'poi',
 ARRAY['shop','store'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),

('poi_points', 'wheelchair_storage',
 (SELECT id
    FROM categories
   WHERE code = 'khadamat'
     AND property_target = 'group'),
 'service', 'wheelchair_storage',
 'poi',
 ARRAY['wheelchair_storage'],
 ARRAY['walk','wheelchair'],
 '{"walking": true, "wheelchair": true}'::jsonb,
 'family')
ON CONFLICT (entity_table, feature_key) DO UPDATE
SET category_leaf_id        = EXCLUDED.category_leaf_id,
    default_group           = EXCLUDED.default_group,
    default_subgroup        = EXCLUDED.default_subgroup,
    default_node_function   = EXCLUDED.default_node_function,
    default_types           = EXCLUDED.default_types,
    default_transport_modes = EXCLUDED.default_transport_modes,
    default_services        = EXCLUDED.default_services,
    default_gender          = EXCLUDED.default_gender;


-- ===== VAN_NODES =====
INSERT INTO feature_group_mappings (
  entity_table, feature_key,
  category_leaf_id,
  default_group, default_subgroup,
  default_node_function, default_types,
  default_transport_modes, default_services, default_gender
) VALUES
('van_nodes', 'stop',
 (SELECT id
    FROM categories
   WHERE code = 'khadamat'
     AND property_target = 'group'),
 'van', 'van_stop',
 'van_node',
 ARRAY['stop','van'],
 ARRAY['van','walk'],
 '{"walking": true, "electricVan": true}'::jsonb,
 'family'),

('van_nodes', 'junction',
 (SELECT id
    FROM categories
   WHERE code = 'khadamat'
     AND property_target = 'group'),
 'van', 'van_junction',
 'van_node',
 ARRAY['junction','van'],
 ARRAY['van'],
 '{"electricVan": true}'::jsonb,
 'family')
ON CONFLICT (entity_table, feature_key) DO UPDATE
SET category_leaf_id        = EXCLUDED.category_leaf_id,
    default_group           = EXCLUDED.default_group,
    default_subgroup        = EXCLUDED.default_subgroup,
    default_node_function   = EXCLUDED.default_node_function,
    default_types           = EXCLUDED.default_types,
    default_transport_modes = EXCLUDED.default_transport_modes,
    default_services        = EXCLUDED.default_services,
    default_gender          = EXCLUDED.default_gender;


-- ===== QR CODES =====
INSERT INTO feature_group_mappings (
  entity_table, feature_key,
  category_leaf_id,
  default_group, default_subgroup,
  default_node_function, default_types,
  default_transport_modes, default_services, default_gender
) VALUES
('qrcodes', 'area',
 (SELECT id
    FROM categories
   WHERE code = 'qrcode'
     AND property_target = 'nodeFunction'),
 'qrcode', 'qrcode_area',
 'qrcode',
 ARRAY['qrcode','area'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),

('qrcodes', 'poi',
 (SELECT id
    FROM categories
   WHERE code = 'qrcode'
     AND property_target = 'nodeFunction'),
 'qrcode', 'qrcode_poi',
 'qrcode',
 ARRAY['qrcode','poi'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family'),

('qrcodes', 'door',
 (SELECT id
    FROM categories
   WHERE code = 'qrcode'
     AND property_target = 'nodeFunction'),
 'qrcode', 'qrcode_door',
 'qrcode',
 ARRAY['qrcode','door'],
 ARRAY['walk','wheelchair','van'],
 '{"walking": true, "wheelchair": true, "electricVan": true}'::jsonb,
 'family'),

('qrcodes', 'generic',
 (SELECT id
    FROM categories
   WHERE code = 'qrcode'
     AND property_target = 'nodeFunction'),
 'qrcode', 'qrcode_generic',
 'qrcode',
 ARRAY['qrcode'],
 ARRAY['walk'],
 '{"walking": true}'::jsonb,
 'family')
ON CONFLICT (entity_table, feature_key) DO UPDATE
SET category_leaf_id        = EXCLUDED.category_leaf_id,
    default_group           = EXCLUDED.default_group,
    default_subgroup        = EXCLUDED.default_subgroup,
    default_node_function   = EXCLUDED.default_node_function,
    default_types           = EXCLUDED.default_types,
    default_transport_modes = EXCLUDED.default_transport_modes,
    default_services        = EXCLUDED.default_services,
    default_gender          = EXCLUDED.default_gender;
