-- HomeOS – sekce Práce pro jakoukoli práci (ne jen kurýr na IČO)
alter table public.work_settings
  add column job_type text not null default 'courier' check (job_type in ('employee', 'shifts', 'courier', 'freelance')),
  add column position text check (position is null or char_length(position) <= 80);
alter table public.work_settings alter column company set default '';
alter table public.work_settings alter column job_type set default 'shifts';
