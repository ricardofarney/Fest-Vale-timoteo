
CREATE OR REPLACE FUNCTION public.confirm_order_payment(
  _order_id uuid,
  _payment_method text,
  _attendees jsonb DEFAULT '[]'::jsonb,
  _coupon_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order orders%ROWTYPE;
  _item order_items%ROWTYPE;
  _batch ticket_batches%ROWTYPE;
  _coupon coupons%ROWTYPE;
  _discount_cents int := 0;
  _new_total int := 0;
  _i int;
  _attendee jsonb;
  _idx int := 0;
BEGIN
  SELECT * INTO _order FROM orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF _order.buyer_id <> auth.uid() THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  IF _order.status <> 'pending' THEN RAISE EXCEPTION 'Pedido não está pendente'; END IF;
  IF _order.expires_at < now() THEN RAISE EXCEPTION 'Pedido expirado'; END IF;

  -- Recompute total from items and lock batches
  FOR _item IN SELECT * FROM order_items WHERE order_id = _order_id LOOP
    SELECT * INTO _batch FROM ticket_batches WHERE id = _item.batch_id FOR UPDATE;
    IF _batch.quantity_sold + _item.qty > _batch.quantity_total THEN
      RAISE EXCEPTION 'Lote % esgotou durante a compra', _batch.name;
    END IF;
    _new_total := _new_total + _item.qty * _item.unit_price_cents;
  END LOOP;

  -- Apply coupon
  IF _coupon_code IS NOT NULL AND length(_coupon_code) > 0 THEN
    SELECT * INTO _coupon FROM coupons
      WHERE event_id = _order.event_id AND upper(code) = upper(_coupon_code)
      FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cupom inválido'; END IF;
    IF _coupon.expires_at IS NOT NULL AND _coupon.expires_at < now() THEN
      RAISE EXCEPTION 'Cupom expirado';
    END IF;
    IF _coupon.max_uses IS NOT NULL AND _coupon.used_count >= _coupon.max_uses THEN
      RAISE EXCEPTION 'Cupom esgotado';
    END IF;
    IF _coupon.discount_pct IS NOT NULL THEN
      _discount_cents := (_new_total * _coupon.discount_pct) / 100;
    ELSIF _coupon.discount_cents IS NOT NULL THEN
      _discount_cents := _coupon.discount_cents;
    END IF;
    _new_total := GREATEST(_new_total - _discount_cents, 0);
    UPDATE coupons SET used_count = used_count + 1 WHERE id = _coupon.id;
    UPDATE orders SET coupon_id = _coupon.id WHERE id = _order_id;
  END IF;

  -- Increment batches and create tickets
  FOR _item IN SELECT * FROM order_items WHERE order_id = _order_id LOOP
    UPDATE ticket_batches SET quantity_sold = quantity_sold + _item.qty WHERE id = _item.batch_id;
    FOR _i IN 1.._item.qty LOOP
      _attendee := _attendees -> _idx;
      INSERT INTO tickets (order_id, batch_id, attendee_name, attendee_doc)
      VALUES (
        _order_id,
        _item.batch_id,
        NULLIF(_attendee->>'name',''),
        NULLIF(_attendee->>'doc','')
      );
      _idx := _idx + 1;
    END LOOP;
  END LOOP;

  UPDATE orders SET status = 'paid', paid_at = now(), payment_method = _payment_method, total_cents = _new_total
    WHERE id = _order_id;

  RETURN _order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid, text, jsonb, text) TO authenticated;
