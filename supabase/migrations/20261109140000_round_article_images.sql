-- Vignette articolo di giornata (testata + per paragrafo).
ALTER TABLE public.round_articles
  ADD COLUMN IF NOT EXISTS header_image_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS paragraph_images JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.round_articles
  DROP CONSTRAINT IF EXISTS round_articles_paragraph_images_is_array;

ALTER TABLE public.round_articles
  ADD CONSTRAINT round_articles_paragraph_images_is_array
  CHECK (jsonb_typeof(paragraph_images) = 'array');

COMMENT ON COLUMN public.round_articles.header_image_url IS 'URL pubblico vignetta di apertura';
COMMENT ON COLUMN public.round_articles.paragraph_images IS 'Array JSON {paragraph_index, url, alt}; paragraph_index 0-based';
