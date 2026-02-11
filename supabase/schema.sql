CREATE TABLE public.expense_splits (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  expense_id uuid NOT NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  is_paid boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT expense_splits_pkey PRIMARY KEY (id),
  CONSTRAINT expense_splits_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.shared_expenses(id),
  CONSTRAINT expense_splits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.fixed_expenses (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  category text NOT NULL,
  description text,
  is_shared boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fixed_expenses_pkey PRIMARY KEY (id),
  CONSTRAINT fixed_expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.house_members (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  house_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'member'::text CHECK (role = ANY (ARRAY['owner'::text, 'member'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT house_members_pkey PRIMARY KEY (id),
  CONSTRAINT house_members_house_id_fkey FOREIGN KEY (house_id) REFERENCES public.houses(id),
  CONSTRAINT house_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.houses (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  invite_code text DEFAULT "substring"(md5((random())::text), 1, 8) UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT houses_pkey PRIMARY KEY (id)
);
CREATE TABLE public.incomes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  description text,
  month date,
  created_at timestamp with time zone DEFAULT now(),
  is_recurring boolean DEFAULT false,
  CONSTRAINT incomes_pkey PRIMARY KEY (id),
  CONSTRAINT incomes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.installment_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  house_id uuid NOT NULL,
  created_by uuid NOT NULL,
  description text NOT NULL,
  category text DEFAULT 'muebles'::text,
  total_amount numeric NOT NULL,
  installments integer NOT NULL,
  monthly_amount numeric NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT installment_expenses_pkey PRIMARY KEY (id),
  CONSTRAINT installment_expenses_house_id_fkey FOREIGN KEY (house_id) REFERENCES public.houses(id),
  CONSTRAINT installment_expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  auth text NOT NULL,
  p256dh text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  device_type text,
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.receipt_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  expense_id uuid NOT NULL,
  name text NOT NULL,
  quantity numeric DEFAULT 1,
  unit_price numeric NOT NULL,
  total numeric NOT NULL,
  category text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT receipt_items_pkey PRIMARY KEY (id),
  CONSTRAINT receipt_items_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.shared_expenses(id)
);
CREATE TABLE public.shared_expenses (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  house_id uuid,
  paid_by uuid NOT NULL,
  total_amount numeric NOT NULL,
  category text NOT NULL,
  description text,
  receipt_url text,
  date date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  is_shared boolean DEFAULT true,
  CONSTRAINT shared_expenses_pkey PRIMARY KEY (id),
  CONSTRAINT shared_expenses_house_id_fkey FOREIGN KEY (house_id) REFERENCES public.houses(id),
  CONSTRAINT shared_expenses_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.users(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
