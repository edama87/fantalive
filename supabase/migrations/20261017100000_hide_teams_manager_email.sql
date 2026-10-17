-- teams.manager_email non deve essere leggibile con la chiave pubblica
-- (anon/authenticated). La SELECT diventa per-colonna, senza manager_email;
-- service_role (chiave segreta, solo server) continua a leggere tutto.
REVOKE SELECT ON public.teams FROM anon, authenticated;
GRANT SELECT (id, name, manager_name, created_at, updated_at) ON public.teams TO anon, authenticated;
