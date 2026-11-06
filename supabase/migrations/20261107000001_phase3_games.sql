-- English Learning Hub · Phase 3
-- 媒體庫、遊戲與作答紀錄。答案只存在伺服器可讀的資料表，學生無法直接查詢。

-- ---------------------------------------------------------------------------
-- 媒體庫：私有 Storage，只由伺服器產生限時連結
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-media', 'question-media', false, 2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  file_name text not null unique check (file_name = lower(file_name) and char_length(file_name) between 1 and 200),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 刪除圖片前確認沒有題目使用；僅供伺服器呼叫。
create function public.media_in_use(p_file_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.questions q
    where q.deleted_at is null and strpos(q.content::text, to_jsonb(p_file_name)::text) > 0
  );
$$;
revoke all on function public.media_in_use(text) from public, anon, authenticated;
grant execute on function public.media_in_use(text) to service_role;

-- ---------------------------------------------------------------------------
-- 遊戲
-- ---------------------------------------------------------------------------
create table public.game_types (
  key text primary key,
  name text not null,
  stage_slugs text[] not null,
  renderer text not null,
  content_types text[] not null,
  is_enabled boolean not null default true
);

insert into public.game_types (key, name, stage_slugs, renderer, content_types) values
  ('alphabet_matching', 'Alphabet Matching', '{kids}', 'match_pairs', '{phonics_item}'),
  ('listen_and_choose', 'Listen and Choose', '{kids}', 'single_choice', '{vocab_item}'),
  ('word_spelling', 'Word Spelling', '{kids}', 'text_input', '{vocab_item}');

create table public.games (
  id uuid primary key default gen_random_uuid(),
  game_type text not null references public.game_types (key) on delete restrict,
  title text not null check (char_length(title) between 1 and 120),
  stage_id uuid not null,
  textbook_id uuid not null,
  unit_id uuid not null,
  question_count integer not null default 8 check (question_count between 2 and 30),
  difficulty_min smallint not null default 1 check (difficulty_min between 1 and 4),
  difficulty_max smallint not null default 4 check (difficulty_max between 1 and 4),
  is_published boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (difficulty_min <= difficulty_max),
  foreign key (stage_id) references public.learning_stages (id) on delete restrict,
  foreign key (textbook_id, stage_id) references public.textbooks (id, stage_id) on delete restrict,
  foreign key (unit_id, textbook_id, stage_id)
    references public.units (id, textbook_id, stage_id) on delete restrict
);
create index games_unit_published_idx on public.games (unit_id, is_published);
create index games_textbook_id_idx on public.games (textbook_id);

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  game_type text not null references public.game_types (key) on delete restrict,
  stage_id uuid not null references public.learning_stages (id) on delete restrict,
  textbook_id uuid not null references public.textbooks (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  assignment_id uuid,
  mode text not null default 'normal' check (mode in ('normal', 'retry_all', 'retry_wrong', 'preview')),
  retry_of_session_id uuid references public.game_sessions (id) on delete set null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  question_total integer not null check (question_total > 0),
  correct_count integer not null default 0,
  score integer check (score between 0 and 100),
  time_spent integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index game_sessions_student_idx on public.game_sessions (student_id, started_at desc);
create index game_sessions_game_id_idx on public.game_sessions (game_id);

create table public.game_session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  position integer not null,
  source_bucket text not null default 'current'
    check (source_bucket in ('current', 'related', 'review', 'mistake')),
  question_snapshot jsonb not null,
  public_round jsonb not null,
  grading_key jsonb not null,
  unique (session_id, position)
);
create index game_session_items_question_id_idx on public.game_session_items (question_id);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  session_item_id uuid not null references public.game_session_items (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  textbook_id uuid not null references public.textbooks (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  topic_id uuid references public.learning_topics (id) on delete set null,
  game_type text not null references public.game_types (key) on delete restrict,
  question_id uuid not null references public.questions (id) on delete restrict,
  selected_answer jsonb not null,
  is_correct boolean not null,
  attempt_no integer not null default 1,
  time_spent integer not null default 0 check (time_spent >= 0),
  completed_at timestamptz not null default now(),
  unique (session_item_id, attempt_no)
);
create index answers_student_completed_idx on public.answers (student_id, completed_at desc);
create index answers_student_unit_idx on public.answers (student_id, unit_id);
create index answers_session_id_idx on public.answers (session_id);
create index answers_question_id_idx on public.answers (question_id);
create index answers_topic_id_idx on public.answers (topic_id);

create table public.student_question_stats (
  student_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  attempt_count integer not null default 0,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  consecutive_correct integer not null default 0,
  last_answered_at timestamptz,
  next_review_at timestamptz,
  is_open_mistake boolean not null default false,
  primary key (student_id, question_id)
);
create index student_question_stats_review_idx on public.student_question_stats (student_id, next_review_at);
create index student_question_stats_open_idx on public.student_question_stats (student_id)
  where is_open_mistake;

create trigger media_assets_updated_at before update on public.media_assets
  for each row execute function public.set_updated_at();
create trigger games_updated_at before update on public.games
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 權限：作答相關資料只有伺服器可寫入
-- ---------------------------------------------------------------------------
revoke all on public.media_assets, public.game_types, public.games, public.game_sessions,
  public.game_session_items, public.answers, public.student_question_stats
  from public, anon, authenticated;

grant select on public.game_types, public.game_sessions, public.answers,
  public.student_question_stats, public.game_session_items, public.media_assets to authenticated;
grant select, insert, update, delete on public.games to authenticated;

alter table public.media_assets enable row level security;
alter table public.game_types enable row level security;
alter table public.games enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_session_items enable row level security;
alter table public.answers enable row level security;
alter table public.student_question_stats enable row level security;

create policy "只有老師可讀取媒體庫" on public.media_assets
  for select to authenticated using ((select public.is_teacher()));
create policy "登入者可讀取遊戲類型" on public.game_types
  for select to authenticated using ((select public.is_active_user()));

create policy "老師可管理全部遊戲" on public.games
  for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));
create policy "學生只能讀取已授權且已發布的遊戲" on public.games
  for select to authenticated
  using (is_published and public.can_access_textbook(textbook_id));

create policy "老師可讀取全部遊戲紀錄，學生只能讀自己" on public.game_sessions
  for select to authenticated
  using (
    (select public.is_teacher())
    or (student_id = (select auth.uid()) and (select public.is_active_user()))
  );
-- 題目內含答案，學生不可讀取。
create policy "只有老師可讀取遊戲題目" on public.game_session_items
  for select to authenticated using ((select public.is_teacher()));
create policy "老師可讀取全部作答，學生只能讀自己" on public.answers
  for select to authenticated
  using (
    (select public.is_teacher())
    or (student_id = (select auth.uid()) and (select public.is_active_user()))
  );
create policy "老師可讀取全部題目統計，學生只能讀自己" on public.student_question_stats
  for select to authenticated
  using (
    (select public.is_teacher())
    or (student_id = (select auth.uid()) and (select public.is_active_user()))
  );
