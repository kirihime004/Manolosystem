-- =========================================================================
-- PHASE 7 follow-up: Frame-by-frame video review with drawn annotations,
-- matching Flow Production Tracking's (ShotGrid's) review tool -- a
-- reviewer scrubs to an exact frame, draws directly on top of it (pen
-- strokes), and that drawing is saved as a note pinned to that frame
-- number. production_notes already had frame_number for exactly this;
-- it just needed somewhere to keep the actual strokes.
--
-- fps lives on production_projects (not per-shot) since a production's
-- frame rate is a project-wide convention, and every frame-accurate seek
-- (currentTime = frame / fps) needs it.
-- =========================================================================
alter table public.production_projects add column fps numeric(6,3) not null default 24;

alter table public.production_notes add column annotation_data jsonb;
alter table public.production_notes add column annotation_width int;
alter table public.production_notes add column annotation_height int;

comment on column public.production_notes.annotation_data is
  'Array of freehand stroke objects ({color, width, points: [[x,y],...]}) in a
   0..annotation_width / 0..annotation_height coordinate space, redrawn as a
   vector overlay scaled to the player''s current size -- never a baked-in
   raster, so it stays sharp at any player size and stays editable.';
