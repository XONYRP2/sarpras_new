-- Change password for current user using old password verification
-- Requires: table public.user_credentials(profile_id uuid, password_hash text)
-- Requires: pgcrypto extension for crypt/gen_salt

create extension if not exists pgcrypto;

create or replace function public.change_own_password(
  p_profile_id uuid,
  p_old_password text,
  p_new_password text
)
returns json
language plpgsql
security definer
as $$
declare
  v_hash text;
begin
  if p_profile_id is null then
    return json_build_object('success', false, 'error', 'Profile ID missing');
  end if;

  select password_hash
    into v_hash
  from public.user_credentials
  where profile_id = p_profile_id;

  if v_hash is null then
    return json_build_object('success', false, 'error', 'Credentials not found');
  end if;

  if crypt(p_old_password, v_hash) <> v_hash then
    return json_build_object('success', false, 'error', 'Password lama salah');
  end if;

  update public.user_credentials
     set password_hash = crypt(p_new_password, gen_salt('bf'))
   where profile_id = p_profile_id;

  return json_build_object('success', true);
end;
$$;

create or replace function public.change_user_password(
  p_profile_id uuid,
  p_old_password text,
  p_new_password text
)
returns json
language plpgsql
security definer
as $$
begin
  return public.change_own_password(p_profile_id, p_old_password, p_new_password);
end;
$$;

grant execute on function public.change_own_password(uuid, text, text) to anon, authenticated;
grant execute on function public.change_user_password(uuid, text, text) to anon, authenticated;
