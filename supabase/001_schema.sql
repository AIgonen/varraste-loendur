-- Varraste Loendur · Supabase skeem v1 · 22.09.2026
-- Käivita Supabase Dashboard → SQL Editor → New query → kleebi → Run.
-- Kõik tabelid on skeemis public; ligipääs ainult sisselogitud kasutajatele (RLS).

-- ---------------------------------------------------------------- tüübid
create type detection_status as enum ('predicted', 'confirmed', 'removed', 'added_by_user');

-- ---------------------------------------------------------------- mudeli versioonid
create table model_version (
  tag            text primary key,                 -- nt 'yolo11n_v01'
  file_name      text not null,                    -- nt 'model.onnx' repo public/ kaustas
  conf_threshold real not null check (conf_threshold between 0 and 1),
  imgsz          int  not null default 1024,
  test_mae       real,                             -- keskmine loendusviga kuldsel testil
  test_exact     real,                             -- täpselt õigete osakaal
  trained_on     int,                              -- treeningfotode arv
  published_at   timestamptz not null default now(),
  is_active      boolean not null default false    -- rakendus laeb selle, kus true
);
create unique index model_version_one_active on model_version (is_active) where is_active;

-- ---------------------------------------------------------------- kimbud
create table bundle (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique,                  -- kimbu tähis saatelehelt (võib puududa)
  material            text,                         -- nt 'S355', 'AISI 304'
  nominal_diameter_mm real,
  created_by          uuid not null default auth.uid() references auth.users(id),
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------- loendused
create table count (
  id              uuid primary key default gen_random_uuid(),
  bundle_id       uuid references bundle(id) on delete set null,
  user_id         uuid not null default auth.uid() references auth.users(id),
  photo_path      text not null,                    -- Storage: photos/<user_id>/<count_id>.jpg
  photo_width     int  not null,
  photo_height    int  not null,
  model_tag       text not null references model_version(tag),
  conf_threshold  real not null,                    -- millise lävega ennustus tehti
  predicted_count int  not null check (predicted_count >= 0),
  final_count     int  check (final_count >= 0),    -- null = veel kinnitamata
  confirmed_at    timestamptz,
  device          text,                             -- navigator.userAgent lühendatult
  latency_ms      int,
  created_at      timestamptz not null default now(),
  constraint final_needs_confirm check ((final_count is null) = (confirmed_at is null))
);
create index count_user_created on count (user_id, created_at desc);
create index count_bundle on count (bundle_id);
create index count_unconfirmed on count (created_at) where confirmed_at is null;

-- ---------------------------------------------------------------- tuvastatud otsad
-- koordinaadid 0–1 skaalas ORIGINAALFOTO suhtes (mitte 1024 px ruudu) – siis on need treeninguks otse kasutatavad
create table detection (
  id         bigint generated always as identity primary key,
  count_id   uuid not null references count(id) on delete cascade,
  cx         real not null check (cx between 0 and 1),
  cy         real not null check (cy between 0 and 1),
  w          real not null check (w  between 0 and 1),
  h          real not null check (h  between 0 and 1),
  confidence real check (confidence between 0 and 1),  -- null, kui kasutaja lisas käsitsi
  status     detection_status not null default 'predicted'
);
create index detection_count on detection (count_id);

-- ---------------------------------------------------------------- vigade logi (telefonist)
create table error_log (
  id         bigint generated always as identity primary key,
  user_id    uuid default auth.uid(),
  message    text not null,
  stack      text,
  device     text,
  app_version text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS
alter table model_version enable row level security;
alter table bundle        enable row level security;
alter table count         enable row level security;
alter table detection     enable row level security;
alter table error_log     enable row level security;

-- mudeliversioonid: kõik sisselogitud loevad; kirjutab ainult service role (Colab / admin)
create policy "mv_read" on model_version for select to authenticated using (true);

-- kimbud: kõik sisselogitud näevad ja loovad (kimp on jagatud objekt)
create policy "bundle_read"   on bundle for select to authenticated using (true);
create policy "bundle_insert" on bundle for insert to authenticated with check (created_by = auth.uid());

-- loendused: igaüks näeb ja muudab ainult enda omi
create policy "count_read"   on count for select to authenticated using (user_id = auth.uid());
create policy "count_insert" on count for insert to authenticated with check (user_id = auth.uid());
create policy "count_update" on count for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- otsad: läbi loenduse omaniku
create policy "det_read"   on detection for select to authenticated
  using (exists (select 1 from count c where c.id = count_id and c.user_id = auth.uid()));
create policy "det_write"  on detection for insert to authenticated
  with check (exists (select 1 from count c where c.id = count_id and c.user_id = auth.uid()));
create policy "det_update" on detection for update to authenticated
  using (exists (select 1 from count c where c.id = count_id and c.user_id = auth.uid()));
create policy "det_delete" on detection for delete to authenticated
  using (exists (select 1 from count c where c.id = count_id and c.user_id = auth.uid()));

-- vigade logi: ainult kirjutamine
create policy "err_insert" on error_log for insert to authenticated with check (true);

-- ---------------------------------------------------------------- Storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- fail peab olema kaustas <oma user_id>/...
create policy "photos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos_read" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------- kinnitamine ühe kutsega
-- Rakendus kutsub: supabase.rpc('confirm_count', { p_count_id, p_final_count, p_detections })
-- p_detections: [{cx,cy,w,h,confidence,status}, ...]  – asendab kõik loenduse otsad
create or replace function confirm_count(p_count_id uuid, p_final_count int, p_detections jsonb)
returns void language plpgsql security invoker as $$
begin
  if not exists (select 1 from count where id = p_count_id and user_id = auth.uid()) then
    raise exception 'loendus ei kuulu kasutajale';
  end if;
  delete from detection where count_id = p_count_id;
  insert into detection (count_id, cx, cy, w, h, confidence, status)
  select p_count_id, (d->>'cx')::real, (d->>'cy')::real, (d->>'w')::real, (d->>'h')::real,
         nullif(d->>'confidence','')::real, (d->>'status')::detection_status
  from jsonb_array_elements(p_detections) d;
  update count set final_count = p_final_count, confirmed_at = now() where id = p_count_id;
end $$;

-- ---------------------------------------------------------------- treeningu eksport (service role, Colab)
-- Annab YOLO-formaadis read: üks rida iga kinnitatud/lisatud otsa kohta, koos foto teega
create or replace view training_export as
select c.id as count_id, c.photo_path, c.photo_width, c.photo_height, c.final_count, c.confirmed_at,
       d.cx, d.cy, d.w, d.h, d.status
from count c join detection d on d.count_id = c.id
where c.confirmed_at is not null and d.status in ('confirmed', 'added_by_user');

-- ---------------------------------------------------------------- esimene mudeliversioon (COCO-proovimudel, kuni päris mudel valmis)
insert into model_version (tag, file_name, conf_threshold, imgsz, is_active)
values ('coco_test', 'yolo11n.onnx', 0.25, 1024, true);
