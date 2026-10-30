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

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_voucher(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_voucher(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_merchant_redemption_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*)
  FROM public.voucher_claims AS claim
  JOIN public.deals AS deal ON deal.id = claim.deal_id
  WHERE deal.user_id = auth.uid()
    AND claim.is_redeemed IS TRUE;
$$;

REVOKE ALL ON FUNCTION public.get_merchant_redemption_count()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_merchant_redemption_count() TO authenticated;
