-- English Learning Hub · Phase 4
-- 冒險世界：闖關島、學習區域、關卡、進度、星星與徽章。
-- 現有遊戲會轉成關卡，舊的完成紀錄會換算成星星，不會遺失。

-- ---------------------------------------------------------------------------
-- 闖關島：沿用 learning_stages
-- ---------------------------------------------------------------------------
alter table public.learning_stages
  add column island_name text,
  add column tagline text,
  add column map_theme text;

update public.learning_stages set island_name = 'English Kids Island',
  tagline = '字母、自然發音、單字與句型', map_theme = 'kids' where slug = 'kids';
update public.learning_stages set island_name = 'English Junior Island',
  tagline = '單字地城、文法實驗室、會考挑戰', map_theme = 'junior' where slug = 'junior';
update public.learning_stages set island_name = 'English Senior Island',
  tagline = '學術單字、閱讀、克漏字與翻譯', map_theme = 'senior' where slug = 'senior';
update public.learning_stages set island_name = coalesce(island_name, name),
  tagline = coalesce(tagline, ''), map_theme = coalesce(map_theme, theme_key);

alter table public.learning_stages
  alter column island_name set not null,
  alter column tagline set not null,
  alter column map_theme set not null;

-- ---------------------------------------------------------------------------
-- 題目來源改為 4 種；AI 生成的題目必須先經老師審核
-- ---------------------------------------------------------------------------
alter table public.questions drop constraint questions_source_type_check;
update public.questions
  set source_type = case when review_status = 'confirmed' then 'ai_approved' else 'ai_generated' end
  where source_type = 'ai_draft';
alter table public.questions
  add constraint questions_source_type_check check (source_type in
    ('teacher_material', 'teacher_original', 'ai_generated', 'ai_approved')),
  add constraint questions_ai_generated_is_draft check (source_type <> 'ai_generated' or review_status = 'draft');

alter table public.passages drop constraint passages_source_type_check;
update public.passages set source_type = 'ai_approved' where source_type = 'ai_draft';
alter table public.passages
  add constraint passages_source_type_check check (source_type in
    ('teacher_material', 'teacher_original', 'ai_generated', 'ai_approved'));

-- ---------------------------------------------------------------------------
-- 學習區域與關卡
-- ---------------------------------------------------------------------------
create table public.island_zones (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.learning_stages (id) on delete restrict,
  textbook_id uuid not null,
  name text not null check (char_length(name) between 1 and 60),
  theme_key text not null check (theme_key in (
    'forest', 'cave', 'village', 'castle', 'lake', 'tower', 'boss',
    'dungeon', 'lab', 'bridge', 'station', 'academy', 'archive', 'workshop', 'practice'
  )),
  description text check (char_length(description) <= 200),
  order_index integer not null,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (textbook_id, stage_id) references public.textbooks (id, stage_id) on delete restrict,
  constraint island_zones_order_key unique (textbook_id, order_index) deferrable initially deferred
);
create index island_zones_stage_idx on public.island_zones (stage_id);

create table public.game_levels (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.island_zones (id) on delete restrict,
  game_id uuid not null unique references public.games (id) on delete restrict,
  title text not null check (char_length(title) between 1 and 120),
  order_index integer not null,
  two_star_percent smallint not null default 60 check (two_star_percent between 1 and 100),
  three_star_percent smallint not null default 90 check (three_star_percent between 1 and 100),
  unlock_rule text not null default 'previous_complete'
    check (unlock_rule in ('previous_complete', 'previous_two_stars', 'always_open')),
  is_boss boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (two_star_percent < three_star_percent),
  constraint game_levels_order_key unique (zone_id, order_index) deferrable initially deferred
);
create index game_levels_zone_idx on public.game_levels (zone_id, is_published);

-- 關卡使用的遊戲必須屬於同一本教材，避免跨教材或跨島混用。
create function public.enforce_level_textbook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.games g join public.island_zones z on z.id = new.zone_id
    where g.id = new.game_id and g.textbook_id = z.textbook_id
  ) then
    raise exception 'level game must use the zone textbook' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger game_levels_same_textbook
  before insert or update of zone_id, game_id on public.game_levels
  for each row execute function public.enforce_level_textbook();

create table public.level_questions (
  level_id uuid not null references public.game_levels (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  position integer not null default 0,
  primary key (level_id, question_id)
);
create index level_questions_question_idx on public.level_questions (question_id);

create table public.student_progress (
  student_id uuid not null references public.profiles (id) on delete cascade,
  level_id uuid not null references public.game_levels (id) on delete cascade,
  stars smallint not null check (stars between 0 and 3),
  best_score integer not null check (best_score between 0 and 100),
  attempt_count integer not null default 0,
  first_completed_at timestamptz,
  last_played_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, level_id)
);
create index student_progress_recent_idx on public.student_progress (student_id, last_played_at desc);
create index student_progress_level_idx on public.student_progress (level_id);

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  icon_key text not null,
  rule text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.badges (code, name, description, icon_key, rule, is_active) values
  ('first_mission', 'First Mission', '第一次完成關卡', 'flag', 'first_level_complete', true),
  ('perfect_score', 'Perfect Score', '第一次作答全部答對', 'hundred', 'perfect_score', true),
  ('daily_explorer', 'Daily Explorer', '完成當天的 Today''s Mission', 'sun', 'daily_mission', true),
  ('review_master', 'Review Master', '完成一次錯題複習且全對', 'refresh', 'review_perfect', true),
  ('reading_explorer', 'Reading Explorer', '完成一個閱讀關卡', 'book', 'reading_level', true);

create table public.student_badges (
  student_id uuid not null references public.profiles (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  session_id uuid references public.game_sessions (id) on delete set null,
  earned_at timestamptz not null default now(),
  primary key (student_id, badge_id)
);

alter table public.game_sessions
  add column level_id uuid references public.game_levels (id) on delete set null,
  add column stars_earned smallint check (stars_earned between 0 and 3);
create index game_sessions_level_idx on public.game_sessions (level_id);

create trigger island_zones_updated_at before update on public.island_zones
  for each row execute function public.set_updated_at();
create trigger game_levels_updated_at before update on public.game_levels
  for each row execute function public.set_updated_at();
create trigger student_progress_updated_at before update on public.student_progress
  for each row execute function public.set_updated_at();
create trigger badges_updated_at before update on public.badges
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 結算：星星只升不降，同一局重送只發放一次
-- ---------------------------------------------------------------------------
create function public.record_level_result(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.game_sessions;
  lvl public.game_levels;
  v_stars integer;
  v_badges text[];
begin
  select * into s from public.game_sessions where id = p_session_id for update;
  if not found or s.status <> 'completed' or s.level_id is null then
    return jsonb_build_object('stars', null, 'badges', '[]'::jsonb);
  end if;

  if s.stars_earned is not null then
    return jsonb_build_object(
      'stars', case when s.mode in ('normal', 'retry_all') then s.stars_earned end,
      'badges', coalesce((
        select jsonb_agg(b.code) from public.student_badges sb
        join public.badges b on b.id = sb.badge_id where sb.session_id = s.id
      ), '[]'::jsonb));
  end if;

  -- 試玩與只練錯題不影響關卡星數，只標記為已結算。
  if s.mode not in ('normal', 'retry_all') then
    update public.game_sessions set stars_earned = 0 where id = s.id;
    return jsonb_build_object('stars', null, 'badges', '[]'::jsonb);
  end if;

  select * into lvl from public.game_levels where id = s.level_id;
  v_stars := case
    when s.score >= lvl.three_star_percent then 3
    when s.score >= lvl.two_star_percent then 2
    else 1 end;

  update public.game_sessions set stars_earned = v_stars where id = s.id;

  insert into public.student_progress as p
    (student_id, level_id, stars, best_score, attempt_count, first_completed_at, last_played_at)
  values (s.student_id, s.level_id, v_stars, s.score, 1, s.completed_at, s.completed_at)
  on conflict (student_id, level_id) do update set
    stars = greatest(p.stars, excluded.stars),
    best_score = greatest(p.best_score, excluded.best_score),
    attempt_count = p.attempt_count + 1,
    first_completed_at = coalesce(p.first_completed_at, excluded.first_completed_at),
    last_played_at = excluded.last_played_at;

  with earned as (
    insert into public.student_badges (student_id, badge_id, session_id)
    select s.student_id, b.id, s.id from public.badges b
    where b.is_active and (b.rule = 'first_level_complete' or (b.rule = 'perfect_score' and s.score = 100))
    on conflict do nothing
    returning badge_id
  )
  select coalesce(array_agg(b.code order by b.code), '{}') into v_badges
  from earned e join public.badges b on b.id = e.badge_id;

  return jsonb_build_object('stars', v_stars, 'badges', to_jsonb(v_badges));
end;
$$;

-- 區域與關卡排序：兩筆在同一筆交易中互換；以呼叫者身分執行，學生會被 RLS 擋下。
create function public.move_zone(p_zone_id uuid, p_direction integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cur public.island_zones;
  nb public.island_zones;
begin
  if p_direction not in (-1, 1) then raise exception 'direction must be -1 or 1'; end if;
  select * into cur from public.island_zones where id = p_zone_id for update;
  if not found then return; end if;
  if p_direction = -1 then
    select * into nb from public.island_zones where textbook_id = cur.textbook_id
      and order_index < cur.order_index order by order_index desc limit 1 for update;
  else
    select * into nb from public.island_zones where textbook_id = cur.textbook_id
      and order_index > cur.order_index order by order_index asc limit 1 for update;
  end if;
  if not found then return; end if;
  update public.island_zones set order_index = nb.order_index where id = cur.id;
  update public.island_zones set order_index = cur.order_index where id = nb.id;
end;
$$;

create function public.move_level(p_level_id uuid, p_direction integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cur public.game_levels;
  nb public.game_levels;
begin
  if p_direction not in (-1, 1) then raise exception 'direction must be -1 or 1'; end if;
  select * into cur from public.game_levels where id = p_level_id for update;
  if not found then return; end if;
  if p_direction = -1 then
    select * into nb from public.game_levels where zone_id = cur.zone_id
      and order_index < cur.order_index order by order_index desc limit 1 for update;
  else
    select * into nb from public.game_levels where zone_id = cur.zone_id
      and order_index > cur.order_index order by order_index asc limit 1 for update;
  end if;
  if not found then return; end if;
  update public.game_levels set order_index = nb.order_index where id = cur.id;
  update public.game_levels set order_index = cur.order_index where id = nb.id;
end;
$$;

revoke all on function public.record_level_result(uuid) from public, anon, authenticated;
grant execute on function public.record_level_result(uuid) to service_role;
revoke all on function public.enforce_level_textbook() from public, anon, authenticated;
revoke all on function public.move_zone(uuid, integer) from public, anon;
revoke all on function public.move_level(uuid, integer) from public, anon;
grant execute on function public.move_zone(uuid, integer) to authenticated;
grant execute on function public.move_level(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 權限
-- ---------------------------------------------------------------------------
revoke all on public.island_zones, public.game_levels, public.level_questions,
  public.student_progress, public.badges, public.student_badges
  from public, anon, authenticated;

grant select, insert, update, delete on public.island_zones, public.game_levels,
  public.level_questions to authenticated;
grant select on public.student_progress, public.badges, public.student_badges to authenticated;

alter table public.island_zones enable row level security;
alter table public.game_levels enable row level security;
alter table public.level_questions enable row level security;
alter table public.student_progress enable row level security;
alter table public.badges enable row level security;
alter table public.student_badges enable row level security;

create policy "老師可管理全部區域" on public.island_zones
  for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));
create policy "學生只能讀取已授權且開放的區域" on public.island_zones
  for select to authenticated
  using (is_open and public.can_access_textbook(textbook_id));

create policy "老師可管理全部關卡" on public.game_levels
  for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));
create policy "學生只能讀取已發布且區域開放的關卡" on public.game_levels
  for select to authenticated
  using (is_published and exists (
    select 1 from public.island_zones z
    where z.id = game_levels.zone_id and z.is_open and public.can_access_textbook(z.textbook_id)
  ));

-- 遊戲改由關卡發布：學生只能讀取「關卡已發布、區域開放、教材已授權」的遊戲設定
drop policy "學生只能讀取已授權且已發布的遊戲" on public.games;
create policy "學生只能讀取已發布關卡的遊戲" on public.games
  for select to authenticated
  using (exists (
    select 1 from public.game_levels l
    where l.game_id = games.id and l.is_published
      and exists (
        select 1 from public.island_zones z
        where z.id = l.zone_id and z.is_open and public.can_access_textbook(z.textbook_id)
      )
  ));

create policy "只有老師可管理指定題目" on public.level_questions
  for all to authenticated
  using ((select public.is_teacher())) with check ((select public.is_teacher()));

create policy "老師可讀取全部進度，學生只能讀自己" on public.student_progress
  for select to authenticated
  using ((select public.is_teacher())
    or (student_id = (select auth.uid()) and (select public.is_active_user())));

create policy "登入者可讀取啟用中的徽章" on public.badges
  for select to authenticated
  using ((select public.is_teacher()) or (is_active and (select public.is_active_user())));

create policy "老師可讀取全部徽章紀錄，學生只能讀自己" on public.student_badges
  for select to authenticated
  using ((select public.is_teacher())
    or (student_id = (select auth.uid()) and (select public.is_active_user())));

-- ---------------------------------------------------------------------------
-- 舊資料轉換：每本有遊戲的教材建立「練習區」，每個遊戲成為一個關卡
-- ---------------------------------------------------------------------------
insert into public.island_zones (stage_id, textbook_id, name, theme_key, order_index)
select distinct g.stage_id, g.textbook_id, '練習區', 'practice', 1 from public.games g;

insert into public.game_levels (zone_id, game_id, title, order_index, is_published)
select z.id, g.id, g.title,
  row_number() over (partition by g.textbook_id order by g.created_at, g.id), g.is_published
from public.games g
join public.island_zones z on z.textbook_id = g.textbook_id and z.theme_key = 'practice';

update public.game_sessions s set level_id = l.id
from public.game_levels l where l.game_id = s.game_id;

update public.game_sessions s set stars_earned = case
    when s.mode not in ('normal', 'retry_all') then 0
    when s.score >= 90 then 3 when s.score >= 60 then 2 else 1 end
where s.status = 'completed' and s.level_id is not null;

insert into public.student_progress
  (student_id, level_id, stars, best_score, attempt_count, first_completed_at, last_played_at)
select s.student_id, s.level_id, max(s.stars_earned), max(s.score), count(*),
  min(s.completed_at), max(s.completed_at)
from public.game_sessions s
where s.status = 'completed' and s.mode in ('normal', 'retry_all') and s.level_id is not null
group by s.student_id, s.level_id;

insert into public.student_badges (student_id, badge_id)
select distinct p.student_id, b.id from public.student_progress p
join public.badges b on b.code = 'first_mission';

insert into public.student_badges (student_id, badge_id)
select distinct s.student_id, b.id from public.game_sessions s
join public.badges b on b.code = 'perfect_score'
where s.status = 'completed' and s.mode in ('normal', 'retry_all') and s.score = 100
on conflict do nothing;
