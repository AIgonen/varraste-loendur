-- Esimene päris mudel rakendusse: yolo11n_v37 (ainult meie fotod, 100 epohhi, seed = 2; sama seadistus kui v33 ja v36).
-- Kuldne test (32 fotot): keskmine viga 1,47, täpselt õige 38%, ±2 piires 84%, max 8. Lävi 0,30.
-- Eeldus: fail app/public/yolo11n_v37.onnx on repos ja push tehtud (GitHub Pages serveerib selle).
-- Vana mudel (coco_test) jääb tabelisse – tagasi lülitamiseks vaheta is_active.
begin;
update model_version set is_active = false where is_active;
insert into model_version (tag, file_name, conf_threshold, imgsz, test_mae, test_exact, trained_on, is_active)
values ('yolo11n_v37', 'yolo11n_v37.onnx', 0.30, 1024, 1.47, 0.38, 266, true)
on conflict (tag) do update set file_name = excluded.file_name, conf_threshold = excluded.conf_threshold,
  test_mae = excluded.test_mae, test_exact = excluded.test_exact, trained_on = excluded.trained_on, is_active = true;
commit;
select tag, file_name, conf_threshold, is_active from model_version order by published_at;
