ALTER TABLE public.redemptions
  ADD COLUMN IF NOT EXISTS redeemed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS redeemed_at timestamptz;

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
GRANT EXECUTE ON FUNCTION public.increment_deal_metric(bigint, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.redeem_voucher(p_voucher_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  normalized_code text := upper(trim(p_voucher_code));
  authenticated_merchant uuid := auth.uid();
BEGIN
  IF authenticated_merchant IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to redeem a voucher';
  END IF;

  IF normalized_code !~ '^LDH-(?:[A-Z0-9]+-)?[A-Z0-9]{4}$' THEN
    RAISE EXCEPTION 'Invalid voucher code format';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(normalized_code)::bigint);

  IF EXISTS (
    SELECT 1
    FROM public.redemptions
    WHERE upper(trim(voucher_code)) = normalized_code
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.redemptions (
    voucher_code,
    merchant_id,
    redeemed,
    redeemed_at
  )
  VALUES (
    normalized_code,
    authenticated_merchant,
    true,
    now()
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_voucher(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_voucher(text) TO authenticated;
