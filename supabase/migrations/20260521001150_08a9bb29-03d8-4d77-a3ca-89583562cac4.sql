
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('organizer', 'attendee', 'staff');
CREATE TYPE public.event_status AS ENUM ('draft', 'published', 'cancelled');
CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'cancelled', 'expired');
CREATE TYPE public.ticket_status AS ENUM ('valid', 'checked_in', 'cancelled');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- USER ROLES (separate table for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- EVENTS
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  cover_url TEXT,
  venue TEXT,
  address TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  status public.event_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX events_status_idx ON public.events (status, starts_at);
CREATE INDEX events_organizer_idx ON public.events (organizer_id);

-- TICKET TYPES
CREATE TABLE public.ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_half_price BOOLEAN NOT NULL DEFAULT false,
  is_solidary BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ticket_types_event_idx ON public.ticket_types (event_id);

-- TICKET BATCHES (lotes com virada)
CREATE TABLE public.ticket_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_type_id UUID NOT NULL REFERENCES public.ticket_types(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_cents INT NOT NULL DEFAULT 0,
  quantity_total INT NOT NULL DEFAULT 0,
  quantity_sold INT NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ticket_batches_type_idx ON public.ticket_batches (ticket_type_id);

-- COUPONS
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_pct INT,
  discount_cents INT,
  max_uses INT,
  used_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, code)
);

-- ORDERS
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  total_cents INT NOT NULL DEFAULT 0,
  status public.order_status NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  coupon_id UUID REFERENCES public.coupons(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_buyer_idx ON public.orders (buyer_id);
CREATE INDEX orders_event_idx ON public.orders (event_id);

-- ORDER ITEMS
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.ticket_batches(id),
  unit_price_cents INT NOT NULL,
  qty INT NOT NULL
);

-- TICKETS
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.ticket_batches(id),
  attendee_name TEXT,
  attendee_doc TEXT,
  qr_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  status public.ticket_status NOT NULL DEFAULT 'valid',
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tickets_order_idx ON public.tickets (order_id);
CREATE INDEX tickets_qr_idx ON public.tickets (qr_token);

-- CHECK IN LOG
CREATE TABLE public.check_in_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scanned_by UUID REFERENCES auth.users(id),
  device_id TEXT,
  result TEXT NOT NULL
);

-- Auto profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'attendee');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_in_log ENABLE ROW LEVEL SECURITY;

-- POLICIES
-- profiles
CREATE POLICY "users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- user_roles
CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- events: public can read published; organizers manage own
CREATE POLICY "anyone reads published events" ON public.events FOR SELECT USING (status = 'published' OR auth.uid() = organizer_id);
CREATE POLICY "organizers insert events" ON public.events FOR INSERT WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "organizers update own events" ON public.events FOR UPDATE USING (auth.uid() = organizer_id);
CREATE POLICY "organizers delete own events" ON public.events FOR DELETE USING (auth.uid() = organizer_id);

-- ticket_types: public read if event published, organizer manage
CREATE POLICY "read ticket types of visible events" ON public.ticket_types FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = ticket_types.event_id AND (e.status = 'published' OR e.organizer_id = auth.uid()))
);
CREATE POLICY "organizer manage ticket types" ON public.ticket_types FOR ALL USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = ticket_types.event_id AND e.organizer_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = ticket_types.event_id AND e.organizer_id = auth.uid())
);

-- ticket_batches
CREATE POLICY "read batches of visible events" ON public.ticket_batches FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.ticket_types t JOIN public.events e ON e.id = t.event_id
    WHERE t.id = ticket_batches.ticket_type_id AND (e.status = 'published' OR e.organizer_id = auth.uid())
  )
);
CREATE POLICY "organizer manage batches" ON public.ticket_batches FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.ticket_types t JOIN public.events e ON e.id = t.event_id
    WHERE t.id = ticket_batches.ticket_type_id AND e.organizer_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ticket_types t JOIN public.events e ON e.id = t.event_id
    WHERE t.id = ticket_batches.ticket_type_id AND e.organizer_id = auth.uid()
  )
);

-- coupons: only organizer
CREATE POLICY "organizer manage coupons" ON public.coupons FOR ALL USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = coupons.event_id AND e.organizer_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = coupons.event_id AND e.organizer_id = auth.uid())
);

-- orders
CREATE POLICY "buyer reads own orders" ON public.orders FOR SELECT USING (
  auth.uid() = buyer_id OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = orders.event_id AND e.organizer_id = auth.uid())
);
CREATE POLICY "buyer creates own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "buyer updates own pending orders" ON public.orders FOR UPDATE USING (auth.uid() = buyer_id);

-- order_items
CREATE POLICY "read items of own orders" ON public.order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND (o.buyer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = o.event_id AND e.organizer_id = auth.uid())))
);
CREATE POLICY "buyer inserts items" ON public.order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.buyer_id = auth.uid())
);

-- tickets
CREATE POLICY "buyer or organizer reads tickets" ON public.tickets FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = tickets.order_id AND (o.buyer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = o.event_id AND e.organizer_id = auth.uid())))
);

-- check_in_log
CREATE POLICY "organizer reads check in log" ON public.check_in_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tickets t JOIN public.orders o ON o.id = t.order_id JOIN public.events e ON e.id = o.event_id
          WHERE t.id = check_in_log.ticket_id AND e.organizer_id = auth.uid())
);

-- STORAGE BUCKET for event covers
INSERT INTO storage.buckets (id, name, public) VALUES ('event-covers', 'event-covers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read event covers" ON storage.objects FOR SELECT USING (bucket_id = 'event-covers');
CREATE POLICY "authenticated upload event covers" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'event-covers' AND auth.uid() IS NOT NULL
);
CREATE POLICY "owner update event covers" ON storage.objects FOR UPDATE USING (
  bucket_id = 'event-covers' AND auth.uid() = owner
);
CREATE POLICY "owner delete event covers" ON storage.objects FOR DELETE USING (
  bucket_id = 'event-covers' AND auth.uid() = owner
);
