ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inquiries_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS whatsapp_clicks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS map_clicks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_deal_metric(
  p_deal_id bigint,
  p_metric text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_metric = 'views_count' THEN
    UPDATE public.deals
    SET views_count = COALESCE(views_count, 0) + 1
    WHERE id = p_deal_id
      AND is_verified_merchant IS TRUE
      AND is_active IS DISTINCT FROM FALSE;
  ELSIF p_metric = 'inquiries_count' THEN
    UPDATE public.deals
    SET inquiries_count = COALESCE(inquiries_count, 0) + 1
    WHERE id = p_deal_id
      AND is_verified_merchant IS TRUE
      AND is_active IS DISTINCT FROM FALSE;
  ELSIF p_metric = 'whatsapp_clicks' THEN
    UPDATE public.deals
    SET whatsapp_clicks = COALESCE(whatsapp_clicks, 0) + 1
    WHERE id = p_deal_id
      AND is_verified_merchant IS TRUE
      AND is_active IS DISTINCT FROM FALSE;
  ELSIF p_metric = 'map_clicks' THEN
    UPDATE public.deals
    SET map_clicks = COALESCE(map_clicks, 0) + 1
    WHERE id = p_deal_id
      AND is_verified_merchant IS TRUE
      AND is_active IS DISTINCT FROM FALSE;
  ELSIF p_metric = 'shares_count' THEN
    UPDATE public.deals
    SET shares_count = COALESCE(shares_count, 0) + 1
    WHERE id = p_deal_id
      AND is_verified_merchant IS TRUE
      AND is_active IS DISTINCT FROM FALSE;
  ELSE
    RAISE EXCEPTION 'Unsupported deal metric';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verified active deal not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_deal_metric(bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_deal_metric(bigint, text)
  TO anon, authenticated;
