-- Phase 5：任務指派、錯題複習、學習紀錄
-- 本檔可重複執行：已存在的物件會先略過或重建，不會影響既有資料。

-- ---------------------------------------------------------------------------
-- 錯題複習：遊戲紀錄新增 review 模式，複習局可跨單元，所以不綁定單一遊戲或單元
-- ---------------------------------------------------------------------------
alter table public.game_sessions drop constraint if exists game_sessions_mode_check;
alter table public.game_sessions
  add constraint game_sessions_mode_check
  check (mode in ('normal', 'retry_all', 'retry_wrong', 'preview', 'review'));

alter table public.game_sessions alter column game_id drop not null;
alter table public.game_sessions alter column unit_id drop not null;
alter table public.game_sessions drop constraint if exists game_sessions_review_shape;
alter table public.game_sessions
  add constraint game_sessions_review_shape
  check (mode = 'review' or (game_id is not null and unit_id is not null));

create index if not exists game_sessions_student_completed_idx
  on public.game_sessions (student_id, completed_at desc) where status = 'completed';

-- 錯題本規則：之後連續答對 2 次就移出（原本為 3 次）
update public.student_question_stats
set is_open_mistake = false
where is_open_mistake and consecutive_correct >= 2;

-- ---------------------------------------------------------------------------
-- 任務指派：每筆指派一個關卡給一個班級或一位學生
-- 完成與否由作答紀錄判斷（指派後拿到至少 2 顆星），不另存結果，避免資料不一致。
-- ---------------------------------------------------------------------------
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.game_levels (id) on delete cascade,
  class_id uuid references public.classes (id) on delete cascade,
  student_id uuid references public.profiles (id) on delete cascade,
  note text check (char_length(note) <= 200),
  due_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignments_one_target check ((class_id is null) <> (student_id is null))
);
create index if not exists assignments_level_idx on public.assignments (level_id);
create index if not exists assignments_class_idx on public.assignments (class_id);
create index if not exists assignments_student_idx on public.assignments (student_id);

drop trigger if exists assignments_updated_at on public.assignments;
create trigger assignments_updated_at before update on public.assignments
  for each row execute function public.set_updated_at();

-- 指派給個人時，對象必須是學生
create or replace function public.enforce_assignment_student()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.student_id is not null and not exists (
    select 1 from public.profiles p where p.id = new.student_id and p.role = 'student'
  ) then
    raise exception 'assignments can only target students' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_assignment_student() from public, anon, authenticated;

drop trigger if exists assignments_student_check on public.assignments;
create trigger assignments_student_check before insert or update on public.assignments
  for each row execute function public.enforce_assignment_student();

-- 學生是否為某班的現任成員（班級未封存）
create or replace function public.is_class_member(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.student_classes sc
    join public.classes c on c.id = sc.class_id
    where sc.class_id = p_class_id
      and sc.student_id = (select auth.uid())
      and sc.left_at is null
      and not c.is_archived
  );
$$;
revoke all on function public.is_class_member(uuid) from public, anon;
grant execute on function public.is_class_member(uuid) to authenticated;

revoke all on public.assignments from public, anon, authenticated;
grant select, insert, update, delete on public.assignments to authenticated;
alter table public.assignments enable row level security;

drop policy if exists "老師可管理全部任務" on public.assignments;
create policy "老師可管理全部任務" on public.assignments
  for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));

drop policy if exists "學生只能讀取指派給自己或所屬班級的任務" on public.assignments;
create policy "學生只能讀取指派給自己或所屬班級的任務" on public.assignments
  for select to authenticated
  using (
    is_active
    and (select public.is_active_user())
    and (student_id = (select auth.uid()) or (class_id is not null and public.is_class_member(class_id)))
  );
