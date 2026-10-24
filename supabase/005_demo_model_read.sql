-- Demorežiim (ilma sisselogimiseta) peab teadma aktiivse mudeli faili ja läve.
-- model_version ei sisalda midagi salajast (failinimi, lävi, testinumbrid), seega lubame lugeda ka anonüümselt.
-- Kirjutada saab endiselt ainult service role. Muud tabelid jäävad anonüümsele kasutajale suletuks.
drop policy if exists "mv_read_anon" on model_version;
create policy "mv_read_anon" on model_version for select to anon using (true);
grant select on model_version to anon;
