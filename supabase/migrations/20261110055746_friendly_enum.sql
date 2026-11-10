-- Friendly games (separate migration: a new enum value cannot be used in the same transaction)
alter type public.game_competition add value if not exists 'friendly';
