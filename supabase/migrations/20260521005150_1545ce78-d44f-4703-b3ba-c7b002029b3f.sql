
CREATE OR REPLACE FUNCTION public.validate_ticket(
  _qr_token text,
  _event_id uuid,
  _device_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ticket tickets%ROWTYPE;
  _order orders%ROWTYPE;
  _type ticket_types%ROWTYPE;
  _batch ticket_batches%ROWTYPE;
  _is_org boolean;
  _result text;
BEGIN
  SELECT EXISTS(SELECT 1 FROM events WHERE id = _event_id AND organizer_id = auth.uid())
    INTO _is_org;
  IF NOT _is_org THEN
    RAISE EXCEPTION 'Não autorizado a validar neste evento';
  END IF;

  SELECT * INTO _ticket FROM tickets WHERE qr_token = _qr_token FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO check_in_log (ticket_id, scanned_by, device_id, result)
    VALUES (NULL, auth.uid(), _device_id, 'invalid')
    ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('status', 'invalid', 'message', 'QR não encontrado');
  END IF;

  SELECT * INTO _order FROM orders WHERE id = _ticket.order_id;
  IF _order.event_id <> _event_id THEN
    INSERT INTO check_in_log (ticket_id, scanned_by, device_id, result)
    VALUES (_ticket.id, auth.uid(), _device_id, 'wrong_event');
    RETURN jsonb_build_object('status', 'invalid', 'message', 'Ingresso de outro evento');
  END IF;
  IF _order.status <> 'paid' THEN
    INSERT INTO check_in_log (ticket_id, scanned_by, device_id, result)
    VALUES (_ticket.id, auth.uid(), _device_id, 'unpaid');
    RETURN jsonb_build_object('status', 'invalid', 'message', 'Pedido não pago');
  END IF;

  SELECT * INTO _batch FROM ticket_batches WHERE id = _ticket.batch_id;
  SELECT * INTO _type FROM ticket_types WHERE id = _batch.ticket_type_id;

  IF _ticket.status = 'cancelled' THEN
    INSERT INTO check_in_log (ticket_id, scanned_by, device_id, result)
    VALUES (_ticket.id, auth.uid(), _device_id, 'cancelled');
    RETURN jsonb_build_object('status', 'cancelled', 'message', 'Ingresso cancelado',
      'attendee_name', _ticket.attendee_name, 'type', _type.name);
  END IF;

  IF _ticket.status = 'checked_in' THEN
    INSERT INTO check_in_log (ticket_id, scanned_by, device_id, result)
    VALUES (_ticket.id, auth.uid(), _device_id, 'duplicate');
    RETURN jsonb_build_object('status', 'duplicate', 'message', 'Ingresso já utilizado',
      'attendee_name', _ticket.attendee_name, 'type', _type.name,
      'checked_in_at', _ticket.checked_in_at);
  END IF;

  UPDATE tickets SET status = 'checked_in', checked_in_at = now(), checked_in_by = auth.uid()
    WHERE id = _ticket.id;
  INSERT INTO check_in_log (ticket_id, scanned_by, device_id, result)
  VALUES (_ticket.id, auth.uid(), _device_id, 'ok');

  RETURN jsonb_build_object('status', 'ok', 'message', 'Entrada liberada',
    'attendee_name', _ticket.attendee_name, 'type', _type.name, 'batch', _batch.name);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_ticket(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_ticket(text, uuid, text) TO authenticated;
