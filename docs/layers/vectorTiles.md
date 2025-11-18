////////////////////////////////////////////
#list of vector tiles by property json tables
////////////////////////////////////////////

1- http://localhost:8080/tiles/public.admin_restrictions.json

{"id":"public.admin_restrictions","schema":"public","name":"admin_restrictions","properties":[{"name":"id","type":"int8","description":""},{"name":"target_table","type":"text","description":""},{"name":"target_id","type":"int8","description":""},{"name":"floor","type":"int2","description":""},{"name":"restrict_type","type":"text","description":""},{"name":"penalty_w","type":"numeric","description":""},{"name":"gender","type":"gender_enum","description":""},{"name":"modes","type":"_text","description":""},{"name":"starts_at","type":"timestamptz","description":""},{"name":"ends_at","type":"timestamptz","description":""},{"name":"schedule","type":"jsonb","description":""},{"name":"reason","type":"text","description":""},{"name":"created_by","type":"text","description":""},{"name":"is_active","type":"bool","description":""},{"name":"created_at","type":"timestamptz","description":""},{"name":"updated_at","type":"timestamptz","description":""}],"geometrytype":"MultiPolygon","center":[0,0],"bounds":[-180,-90,180,90],"minzoom":0,"maxzoom":22,"tileurl":"http://localhost/public.admin_restrictions/{z}/{x}/{y}.pbf"}

2- http://localhost:8080/tiles/public.areas.json

{"id":"public.areas","schema":"public","name":"areas","properties":[{"name":"id","type":"int8","description":""},{"name":"area_type","type":"area_type_enum","description":""},{"name":"floor","type":"int2","description":""},{"name":"allowed_gender","type":"gender_enum","description":""},{"name":"is_closed","type":"bool","description":""},{"name":"weight_open_space","type":"numeric","description":""},{"name":"attrs","type":"jsonb","description":""},{"name":"updated_at","type":"timestamptz","description":""}],"geometrytype":"MultiPolygon","center":[59.61555676453928,36.28796162489171],"bounds":[59.61018842301069,36.2817548287271,59.62092510606787,36.29416842105632],"minzoom":0,"maxzoom":22,"tileurl":"http://localhost/public.areas/{z}/{x}/{y}.pbf"}

3-http://localhost:8080/tiles/public.areas_simplified.json 

{"id":"public.areas_simplified","schema":"public","name":"areas_simplified","properties":[{"name":"id","type":"int8","description":""}],"geometrytype":"MultiPolygon","center":[59.615556772893555,36.28796162309104],"bounds":[59.61013495098894,36.28169290965149,59.62097859479816,36.294230336530596],"minzoom":0,"maxzoom":22,"tileurl":"http://localhost/public.areas_simplified/{z}/{x}/{y}.pbf"}

4-http://localhost:8080/tiles/public.doors.json

{"id":"public.doors","schema":"public","name":"doors","properties":[{"name":"id","type":"int8","description":""},{"name":"from_area","type":"int8","description":""},{"name":"to_area","type":"int8","description":""},{"name":"floor","type":"int2","description":""},{"name":"allowed_gender","type":"gender_enum","description":""},{"name":"is_open","type":"bool","description":""},{"name":"modes","type":"_text","description":""},{"name":"bidirectional","type":"bool","description":""},{"name":"attrs","type":"jsonb","description":""},{"name":"updated_at","type":"timestamptz","description":""}],"geometrytype":"LineString","center":[59.615871588520335,36.287488330484834],"bounds":[59.61100555641266,36.28395412225728,59.62073762062801,36.29102253871238],"minzoom":0,"maxzoom":22,"tileurl":"http://localhost/public.doors/{z}/{x}/{y}.pbf"}

5-http://localhost:8080/tiles/public.mesh_triangles.json

{"id":"public.mesh_triangles","schema":"public","name":"mesh_triangles","properties":[{"name":"id","type":"int8","description":""},{"name":"floor","type":"int2","description":""},{"name":"area_id","type":"int8","description":""},{"name":"attrs","type":"jsonb","description":""}],"geometrytype":"Polygon","center":[0,0],"bounds":[-180,-90,180,90],"minzoom":0,"maxzoom":22,"tileurl":"http://localhost/public.mesh_triangles/{z}/{x}/{y}.pbf"}


6-http://localhost:8080/tiles/public.poi_points.json

{"id":"public.poi_points","schema":"public","name":"poi_points","properties":[{"name":"id","type":"int8","description":""},{"name":"poi_type","type":"poi_type_enum","description":""},{"name":"floor","type":"int2","description":""},{"name":"has_content","type":"bool","description":""},{"name":"attrs","type":"jsonb","description":""},{"name":"updated_at","type":"timestamptz","description":""}],"geometrytype":"Point","center":[59.61534649347874,36.287931287479246],"bounds":[59.60996063176853,36.28416410776197,59.62073235518894,36.291698467196525],"minzoom":0,"maxzoom":22,"tileurl":"http://localhost/public.poi_points/{z}/{x}/{y}.pbf"}


7-http://localhost:8080/tiles/public.qrcodes.json

{"id":"public.qrcodes","schema":"public","name":"qrcodes","properties":[{"name":"id","type":"int8","description":""},{"name":"code","type":"text","description":""},{"name":"target_type","type":"target_type_enum","description":""},{"name":"target_id","type":"int8","description":""},{"name":"version","type":"int4","description":""},{"name":"is_active","type":"bool","description":""},{"name":"attrs","type":"jsonb","description":""},{"name":"updated_at","type":"timestamptz","description":""}],"geometrytype":"Point","center":[59.61641755152179,36.28813325145525],"bounds":[59.61548776186095,36.28723319229955,59.61734734118263,36.28903331061094],"minzoom":0,"maxzoom":22,"tileurl":"http://localhost/public.qrcodes/{z}/{x}/{y}.pbf"}

8-http://localhost:8080/tiles/public.van_edges.json

{"id":"public.van_edges","schema":"public","name":"van_edges","properties":[{"name":"id","type":"int8","description":""},{"name":"src","type":"int8","description":""},{"name":"dst","type":"int8","description":""},{"name":"length_m","type":"numeric","description":""},{"name":"one_way","type":"bool","description":""},{"name":"is_open","type":"bool","description":""},{"name":"attrs","type":"jsonb","description":""}],"geometrytype":"LineString","center":[0,0],"bounds":[-180,-90,180,90],"minzoom":0,"maxzoom":22,"tileurl":"http://localhost/public.van_edges/{z}/{x}/{y}.pbf"}

9-http://localhost:8080/tiles/public.van_nodes.json

{"id":"public.van_nodes","schema":"public","name":"van_nodes","properties":[{"name":"id","type":"int8","description":""},{"name":"node_type","type":"van_node_type_enum","description":""},{"name":"floor","type":"int2","description":""},{"name":"updated_at","type":"timestamptz","description":""}],"geometrytype":"Point","center":[0,0],"bounds":[-180,-90,180,90],"minzoom":0,"maxzoom":22,"tileurl":"http://localhost/public.van_nodes/{z}/{x}/{y}.pbf"}






////////////////////////////////////////////
#list of vector tiles by property json functions
////////////////////////////////////////////

1-http://localhost:8080/tiles/public.fn_map_features_mvt.json

{"id":"public.fn_map_features_mvt","schema":"public","name":"fn_map_features_mvt","arguments":[{"name":"p_lang","type":"lang_enum","default":"fa_enum"},{"name":"p_floor","type":"smallint","default":"NULL::smallint"},{"name":"p_gender","type":"text","default":"NULL::text"},{"name":"p_entity_tables","type":"text","default":"NULL::text"}],"minzoom":0,"maxzoom":22,"tileurl":"http://localhost/public.fn_map_features_mvt/{z}/{x}/{y}.pbf"}

2- http://localhost:8080/tiles/public.areas_mvt.json

{"id":"public.areas_mvt","schema":"public","name":"areas_mvt","arguments":[{"name":"p_floor","type":"smallint","default":"NULL::smallint"}],"minzoom":0,"maxzoom":22,"tileurl":"http://localhost/public.areas_mvt/{z}/{x}/{y}.pbf"}

