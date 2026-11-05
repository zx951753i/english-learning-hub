-- English Learning Hub · Phase 1
-- 學習階段、帳號、班級與權限。預設全部拒絕，只開放下方明確列出的存取。

-- ---------------------------------------------------------------------------
-- 共用：自動更新 updated_at
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 資料表
-- ---------------------------------------------------------------------------
create table public.learning_stages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  theme_key text not null,
  difficulty_labels jsonb not null,
  order_index integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('teacher', 'student')),
  display_name text not null check (char_length(display_name) between 1 and 50),
  username text not null unique
    check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  avatar_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.learning_stages (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 60),
  description text check (char_length(description) <= 300),
  is_archived boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index classes_stage_id_idx on public.classes (stage_id);
create index classes_created_by_idx on public.classes (created_by);

create table public.student_classes (
  student_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (student_id, class_id)
);
create index student_classes_class_id_idx on public.student_classes (class_id);

create trigger learning_stages_updated_at before update on public.learning_stages
  for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger classes_updated_at before update on public.classes
  for each row execute function public.set_updated_at();

-- 班級成員只能是學生帳號。
create function public.enforce_student_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.student_id and p.role = 'student'
  ) then
    raise exception 'only students can join a class' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger student_classes_student_only
  before insert or update of student_id on public.student_classes
  for each row execute function public.enforce_student_membership();

-- ---------------------------------------------------------------------------
-- 權限函式
-- ---------------------------------------------------------------------------
create function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active
  );
$$;

create function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active and p.role = 'teacher'
  );
$$;

revoke all on function public.is_active_user() from public, anon;
revoke all on function public.is_teacher() from public, anon;
revoke all on function public.enforce_student_membership() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_teacher() to authenticated;

-- ---------------------------------------------------------------------------
-- 資料表權限：先收回 Supabase 預設授權，再逐項開放
-- ---------------------------------------------------------------------------
revoke all on public.learning_stages, public.profiles, public.classes, public.student_classes
  from public, anon, authenticated;

grant select on public.learning_stages, public.profiles to authenticated;
grant select, insert, update, delete on public.classes, public.student_classes to authenticated;
-- profiles 僅能由伺服器以 secret key 寫入，學生與瀏覽器都無法修改 role。

alter table public.learning_stages enable row level security;
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.student_classes enable row level security;

-- ---------------------------------------------------------------------------
-- RLS 規則
-- ---------------------------------------------------------------------------
create policy "登入者可讀取啟用中的階段" on public.learning_stages
  for select to authenticated
  using ((is_active and (select public.is_active_user())) or (select public.is_teacher()));

create policy "老師可讀取全部帳號，學生只能讀自己" on public.profiles
  for select to authenticated
  using (
    (select public.is_teacher())
    or (id = (select auth.uid()) and is_active)
  );

create policy "老師可讀取全部班級，學生只能讀自己所屬班級" on public.classes
  for select to authenticated
  using (
    (select public.is_teacher())
    or (
      (select public.is_active_user())
      and not is_archived
      and exists (
        select 1 from public.student_classes sc
        where sc.class_id = classes.id
          and sc.student_id = (select auth.uid())
          and sc.left_at is null
      )
    )
  );
create policy "老師可新增班級" on public.classes
  for insert to authenticated with check ((select public.is_teacher()));
create policy "老師可修改班級" on public.classes
  for update to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));
create policy "老師可刪除班級" on public.classes
  for delete to authenticated using ((select public.is_teacher()));

create policy "老師可讀取全部成員，學生只能讀自己的紀錄" on public.student_classes
  for select to authenticated
  using (
    (select public.is_teacher())
    or (student_id = (select auth.uid()) and (select public.is_active_user()))
  );
create policy "老師可新增班級成員" on public.student_classes
  for insert to authenticated with check ((select public.is_teacher()));
create policy "老師可修改班級成員" on public.student_classes
  for update to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));
create policy "老師可移除班級成員" on public.student_classes
  for delete to authenticated using ((select public.is_teacher()));

-- ---------------------------------------------------------------------------
-- 三個獨立的學習階段（結構設定，不是教材內容）
-- ---------------------------------------------------------------------------
insert into public.learning_stages (slug, name, theme_key, difficulty_labels, order_index) values
  ('kids', 'English Kids', 'kids', '["Level 1","Level 2","Level 3","Level 4"]', 1),
  ('junior', 'English Junior', 'junior', '["Level 1","Level 2","Level 3","Level 4"]', 2),
  ('senior', 'English Senior', 'senior', '["基礎","中階","進階","學測挑戰"]', 3);
