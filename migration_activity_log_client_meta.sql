-- ==================================================
-- Activity Log: add client app + update log_activity RPC
-- ==================================================

ALTER TABLE public.activity_log
ADD COLUMN IF NOT EXISTS client_app text;

CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id uuid,
  p_action text,
  p_module text,
  p_description text,
  p_data_before jsonb DEFAULT NULL,
  p_data_after jsonb DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_client_app text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.activity_log (
    user_id,
    action,
    module,
    description,
    data_before,
    data_after,
    ip_address,
    user_agent,
    client_app
  ) VALUES (
    p_user_id,
    p_action,
    p_module,
    p_description,
    p_data_before,
    p_data_after,
    p_ip_address,
    p_user_agent,
    p_client_app
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_activity(
  uuid, text, text, text, jsonb, jsonb, text, text, text
) TO anon, authenticated;
