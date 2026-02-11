-- Admin reset password for a user
-- Requires: table public.user_credentials(profile_id uuid, password_hash text)
-- Requires: pgcrypto extension for crypt/gen_salt

create extension if not exists pgcrypto;

create or replace function public.admin_reset_user_password(
  p_admin_id uuid,
  p_profile_id uuid,
  p_new_password text
)
returns json
language plpgsql
security definer
as $$
declare
  v_role text;
begin
  if p_admin_id is null then
    return json_build_object('success', false, 'error', 'Admin ID missing');
  end if;

  select role into v_role
  from public.profiles
  where id = p_admin_id;

  if v_role is distinct from 'admin' then
    return json_build_object('success', false, 'error', 'Unauthorized');
  end if;

  update public.user_credentials
     set password_hash = crypt(p_new_password, gen_salt('bf'))
   where profile_id = p_profile_id;

  if not found then
    return json_build_object('success', false, 'error', 'User not found');
  end if;

  return json_build_object('success', true);
end;
$$;

grant execute on function public.admin_reset_user_password(uuid, uuid, text) to anon, authenticated;
