-- Phase 6：新遊戲、Final Boss Challenge、音檔
-- 本檔可重複執行。

-- 新遊戲類型（Final Boss 一局混合多種介面）
insert into public.game_types (key, name, stage_slugs, renderer, content_types) values
  ('picture_vocabulary', 'Picture Vocabulary', '{kids}', 'single_choice', '{vocab_item}'),
  ('phonics_sound_match', 'Phonics Sound Match', '{kids}', 'single_choice', '{phonics_item}'),
  ('sentence_builder', 'Sentence Builder', '{kids}', 'order_chunks', '{sentence_item}'),
  ('final_boss', 'Final Boss Challenge', '{kids}', 'mixed', '{vocab_item,phonics_item,sentence_item}')
on conflict (key) do update
  set name = excluded.name,
      stage_slugs = excluded.stage_slugs,
      renderer = excluded.renderer,
      content_types = excluded.content_types;

-- 媒體庫接受音檔：MP3、M4A（iPhone 語音備忘錄）、WAV，單檔 4 MB（圖片在程式中仍限制 2 MB）
update storage.buckets
set file_size_limit = 4194304,
    allowed_mime_types = array[
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'audio/mpeg', 'audio/mp4', 'audio/wav'
    ]
where id = 'question-media';
