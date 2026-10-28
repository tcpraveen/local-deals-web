CREATE TABLE IF NOT EXISTS public.voucher_claims (
  voucher_code text PRIMARY KEY,
  deal_id bigint NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_redeemed boolean NOT NULL DEFAULT false,
  redeemed_at timestamptz,
  redeemed_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS voucher_claims_deal_id_idx
  ON public.voucher_claims (deal_id);

ALTER TABLE public.voucher_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.voucher_claims FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_voucher(p_deal_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  issued_code text;
  attempt integer := 0;
BEGIN
  PERFORM 1
  FROM public.deals
  WHERE id = p_deal_id
    AND is_verified_merchant IS TRUE
    AND is_active IS DISTINCT FROM FALSE
    AND (expires_at IS NULL OR expires_at::date >= current_date)
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This offer is not available for voucher claims';
  END IF;

  LOOP
    attempt := attempt + 1;
    issued_code := 'LDH-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    INSERT INTO public.voucher_claims (voucher_code, deal_id)
    VALUES (issued_code, p_deal_id)
    ON CONFLICT (voucher_code) DO NOTHING;

    IF FOUND THEN
      RETURN issued_code;
    END IF;

    IF attempt >= 5 THEN
      RAISE EXCEPTION 'Unable to issue a unique voucher code';
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_voucher(p_voucher_code text)
RETURNS TABLE (
  status text,
  voucher_code text,
  deal_title text,
  business text,
  discount text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  normalized_code text := upper(trim(p_voucher_code));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to validate a voucher';
  END IF;

  IF normalized_code !~ '^LDH-[A-F0-9]{8}$' THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    CASE WHEN NOT voucher.is_redeemed THEN 'valid' ELSE 'already_redeemed' END,
    voucher.voucher_code,
    deal.title,
    deal.business,
    deal.discount
  FROM public.voucher_claims AS voucher
  JOIN public.deals AS deal ON deal.id = voucher.deal_id
  WHERE voucher.voucher_code = normalized_code
    AND deal.user_id = auth.uid()
    AND deal.is_verified_merchant IS TRUE
    AND deal.is_active IS DISTINCT FROM FALSE
    AND (deal.expires_at IS NULL OR deal.expires_at::date >= current_date);

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::text, NULL::text, NULL::text, NULL::text;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_voucher(p_voucher_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  normalized_code text := upper(trim(p_voucher_code));
  authenticated_merchant uuid := auth.uid();
  voucher public.voucher_claims%ROWTYPE;
BEGIN
  IF authenticated_merchant IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to redeem a voucher';
  END IF;

  IF normalized_code !~ '^LDH-[A-F0-9]{8}$' THEN
    RAISE EXCEPTION 'Invalid voucher code format';
  END IF;

  SELECT claim.*
  INTO voucher
  FROM public.voucher_claims AS claim
  JOIN public.deals AS deal ON deal.id = claim.deal_id
  WHERE claim.voucher_code = normalized_code
    AND deal.user_id = authenticated_merchant
    AND deal.is_verified_merchant IS TRUE
    AND deal.is_active IS DISTINCT FROM FALSE
    AND (deal.expires_at IS NULL OR deal.expires_at::date >= current_date)
  FOR UPDATE OF claim;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voucher not found for an active offer owned by this merchant';
  END IF;

  IF voucher.is_redeemed THEN
    RETURN false;
  END IF;

  UPDATE public.voucher_claims
  SET is_redeemed = true,
      redeemed_at = now(),
      redeemed_by = authenticated_merchant
  WHERE voucher_code = normalized_code
    AND is_redeemed IS FALSE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.redemptions (voucher_code, merchant_id, redeemed, redeemed_at)
  VALUES (normalized_code, authenticated_merchant, true, now());

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_voucher(bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_voucher(bigint) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.validate_voucher(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_voucher(text) TO authenticated;

REVOKE ALL ON FUNCTION public.redeem_voucher(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_voucher(text) TO authenticated;
