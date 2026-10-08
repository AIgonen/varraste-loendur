-- Käsitsi loetud arv (laomees luges kimbu üle) – kuldse testi ja mudeli kontrolli jaoks.
-- final_count = kinnitatud ringide arv; manual_count = inimese loetud arv. Kui need erinevad, vajab foto märgistus ülevaatust.
-- Käivita Supabase → SQL Editor → Run. Kordamine on ohutu.

alter table count add column if not exists manual_count int check (manual_count >= 0);

-- Treeningu eksport näitab ka käsitsi arvu (uus veerg lõpus; vaate õigused jäävad samaks)
create or replace view training_export as
select c.id as count_id, c.photo_path, c.photo_width, c.photo_height, c.final_count, c.confirmed_at,
       d.cx, d.cy, d.w, d.h, d.status, c.manual_count
from count c join detection d on d.count_id = c.id
where c.confirmed_at is not null and d.status in ('confirmed', 'added_by_user');

-- Kuldse testi kandidaadid: fotod, mille arv on käsitsi kontrollitud
-- select id, photo_path, final_count, manual_count from count where manual_count is not null order by created_at desc;
