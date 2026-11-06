-- English Learning Hub · Phase 2
-- 教材、單元、主題與題庫。複合外鍵確保教材、單元與題目不會跨學習階段。

alter table public.classes
  add constraint classes_id_stage_key unique (id, stage_id);

-- ---------------------------------------------------------------------------
-- 教材結構
-- ---------------------------------------------------------------------------
create table public.textbooks (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.learning_stages (id) on delete restrict,
  title text not null check (char_length(title) between 1 and 120),
  publisher text check (char_length(publisher) <= 60),
  series text check (char_length(series) <= 60),
  grade text check (char_length(grade) <= 30),
  kind text not null default 'textbook' check (kind in ('textbook', 'exam_prep', 'custom')),
  cover_path text,
  order_index integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, stage_id)
);
create index textbooks_stage_id_idx on public.textbooks (stage_id, order_index);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  textbook_id uuid not null,
  stage_id uuid not null,
  title text not null check (char_length(title) between 1 and 120),
  order_index integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (textbook_id, stage_id) references public.textbooks (id, stage_id) on delete restrict,
  unique (id, textbook_id, stage_id),
  constraint units_textbook_order_key unique (textbook_id, order_index) deferrable initially deferred
);

create table public.learning_topics (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete restrict,
  skill text not null check (skill in (
    'vocabulary', 'phonics', 'grammar', 'sentence', 'listening',
    'speaking', 'reading', 'writing', 'exam'
  )),
  title text not null check (char_length(title) between 1 and 120),
  concept_tags text[] not null default '{}',
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, unit_id)
);
create index learning_topics_unit_id_idx on public.learning_topics (unit_id, order_index);
create index learning_topics_concept_tags_idx on public.learning_topics using gin (concept_tags);

create table public.passages (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.learning_stages (id) on delete restrict,
  unit_id uuid not null references public.units (id) on delete restrict,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 20000),
  audio_path text,
  source_type text not null check (source_type in ('teacher_material', 'teacher_original', 'ai_draft')),
  source_note text check (char_length(source_note) <= 300),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, unit_id)
);
create index passages_unit_id_idx on public.passages (unit_id);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  content_type text not null,
  textbook_id uuid not null references public.textbooks (id) on delete cascade,
  status text not null default 'previewed' check (status in ('previewed', 'imported', 'cancelled')),
  total_rows integer not null default 0,
  success_rows integer not null default 0,
  error_rows integer not null default 0,
  errors jsonb not null default '[]',
  rows jsonb not null default '[]',
  created_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index import_batches_created_idx on public.import_batches (created_by, created_at desc);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null,
  textbook_id uuid not null,
  unit_id uuid not null,
  topic_id uuid,
  passage_id uuid,
  content_type text not null check (content_type in (
    'vocab_item', 'phonics_item', 'sentence_item', 'choice_item',
    'cloze_item', 'sorting_item', 'error_item'
  )),
  difficulty smallint not null check (difficulty between 1 and 4),
  exam_band text check (exam_band in ('B', 'B+', 'A', 'A++')),
  content jsonb not null,
  answer_key jsonb not null,
  explanation_zh text check (char_length(explanation_zh) <= 2000),
  search_text text not null default '',
  tags text[] not null default '{}',
  source_type text not null check (source_type in ('teacher_material', 'teacher_original', 'ai_draft')),
  source_note text check (char_length(source_note) <= 300),
  review_status text not null default 'draft' check (review_status in ('draft', 'confirmed')),
  is_active boolean not null default false,
  deleted_at timestamptz,
  import_batch_id uuid references public.import_batches (id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (textbook_id, stage_id) references public.textbooks (id, stage_id) on delete restrict,
  foreign key (unit_id, textbook_id, stage_id)
    references public.units (id, textbook_id, stage_id) on delete restrict,
  foreign key (topic_id, unit_id) references public.learning_topics (id, unit_id) on delete restrict,
  foreign key (passage_id, unit_id) references public.passages (id, unit_id) on delete restrict,
  -- 只有老師確認過的題目才能開放給學生。
  constraint questions_active_requires_confirmed check (not is_active or review_status = 'confirmed'),
  constraint questions_archived_is_inactive check (deleted_at is null or not is_active)
);
create index questions_unit_ready_idx on public.questions (unit_id, is_active, review_status);
create index questions_topic_id_idx on public.questions (topic_id);
create index questions_stage_filter_idx on public.questions (stage_id, content_type, difficulty);
create index questions_textbook_id_idx on public.questions (textbook_id);
create index questions_tags_idx on public.questions using gin (tags);

create table public.class_textbooks (
  class_id uuid not null,
  textbook_id uuid not null,
  stage_id uuid not null,
  current_unit_id uuid,
  spiral_config jsonb not null default '{"current":70,"related":20,"review":10}',
  created_at timestamptz not null default now(),
  primary key (class_id, textbook_id),
  foreign key (class_id, stage_id) references public.classes (id, stage_id) on delete cascade,
  foreign key (textbook_id, stage_id) references public.textbooks (id, stage_id) on delete restrict,
  foreign key (current_unit_id, textbook_id, stage_id)
    references public.units (id, textbook_id, stage_id) on delete restrict
);
create index class_textbooks_textbook_id_idx on public.class_textbooks (textbook_id);

create trigger textbooks_updated_at before update on public.textbooks
  for each row execute function public.set_updated_at();
create trigger units_updated_at before update on public.units
  for each row execute function public.set_updated_at();
create trigger learning_topics_updated_at before update on public.learning_topics
  for each row execute function public.set_updated_at();
create trigger passages_updated_at before update on public.passages
  for each row execute function public.set_updated_at();
create trigger import_batches_updated_at before update on public.import_batches
  for each row execute function public.set_updated_at();
create trigger questions_updated_at before update on public.questions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 權限函式
-- ---------------------------------------------------------------------------
create function public.can_access_textbook(p_textbook_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_teacher() or exists (
    select 1
    from public.class_textbooks ct
    join public.classes c on c.id = ct.class_id
    join public.student_classes sc on sc.class_id = c.id
    join public.textbooks t on t.id = ct.textbook_id
    join public.profiles p on p.id = sc.student_id
    where ct.textbook_id = p_textbook_id
      and sc.student_id = (select auth.uid())
      and sc.left_at is null
      and not c.is_archived
      and t.is_active
      and p.is_active
  );
$$;

-- 兩個單元在同一筆交易中互換順序；以呼叫者身分執行，學生會被 RLS 擋下。
create function public.move_unit(p_unit_id uuid, p_direction integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_unit public.units;
  neighbor public.units;
begin
  if p_direction not in (-1, 1) then
    raise exception 'direction must be -1 or 1';
  end if;

  select * into current_unit from public.units where id = p_unit_id for update;
  if not found then
    return;
  end if;

  if p_direction = -1 then
    select * into neighbor from public.units
    where textbook_id = current_unit.textbook_id and order_index < current_unit.order_index
    order by order_index desc limit 1 for update;
  else
    select * into neighbor from public.units
    where textbook_id = current_unit.textbook_id and order_index > current_unit.order_index
    order by order_index asc limit 1 for update;
  end if;
  if not found then
    return;
  end if;

  update public.units set order_index = neighbor.order_index where id = current_unit.id;
  update public.units set order_index = current_unit.order_index where id = neighbor.id;
end;
$$;

revoke all on function public.can_access_textbook(uuid) from public, anon;
revoke all on function public.move_unit(uuid, integer) from public, anon;
grant execute on function public.can_access_textbook(uuid) to authenticated;
grant execute on function public.move_unit(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 資料表權限與 RLS
-- ---------------------------------------------------------------------------
revoke all on public.textbooks, public.units, public.learning_topics, public.passages,
  public.import_batches, public.questions, public.class_textbooks
  from public, anon, authenticated;

grant select, insert, update, delete on public.textbooks, public.units, public.learning_topics,
  public.passages, public.import_batches, public.questions, public.class_textbooks
  to authenticated;

alter table public.textbooks enable row level security;
alter table public.units enable row level security;
alter table public.learning_topics enable row level security;
alter table public.passages enable row level security;
alter table public.import_batches enable row level security;
alter table public.questions enable row level security;
alter table public.class_textbooks enable row level security;

create policy "老師可管理全部教材" on public.textbooks
  for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));
create policy "學生只能讀取已授權教材" on public.textbooks
  for select to authenticated
  using (is_active and public.can_access_textbook(id));

create policy "老師可管理全部單元" on public.units
  for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));
create policy "學生只能讀取已授權單元" on public.units
  for select to authenticated
  using (is_active and public.can_access_textbook(textbook_id));

create policy "老師可管理全部主題" on public.learning_topics
  for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));
create policy "學生只能讀取已授權主題" on public.learning_topics
  for select to authenticated
  using (exists (
    select 1 from public.units u
    where u.id = learning_topics.unit_id
      and u.is_active
      and public.can_access_textbook(u.textbook_id)
  ));

create policy "老師可管理班級教材" on public.class_textbooks
  for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));
create policy "學生只能讀取自己班級的教材" on public.class_textbooks
  for select to authenticated
  using (
    (select public.is_active_user())
    and exists (
      select 1 from public.student_classes sc
      where sc.class_id = class_textbooks.class_id
        and sc.student_id = (select auth.uid())
        and sc.left_at is null
    )
  );

-- 題目含答案，學生一律不可直接讀取，遊戲由伺服器移除答案後提供。
create policy "只有老師可存取題目" on public.questions
  for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));
create policy "只有老師可存取文章" on public.passages
  for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));
create policy "只有老師可存取匯入紀錄" on public.import_batches
  for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));
