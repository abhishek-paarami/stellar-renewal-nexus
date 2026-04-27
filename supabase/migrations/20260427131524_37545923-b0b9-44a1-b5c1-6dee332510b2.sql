-- Tighten function search_path
alter function public.tg_set_updated_at() set search_path = public;
alter function public.tg_reset_reminder_flags() set search_path = public;

-- Revoke broad execute and grant explicitly to authenticated
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.is_active_user(uuid) from public, anon;
revoke all on function public.current_user_role() from public, anon;
revoke all on function public.get_crypto_key() from public, anon, authenticated;
revoke all on function public.enc_text(text) from public, anon, authenticated;
revoke all on function public.dec_text(bytea) from public, anon, authenticated;
revoke all on function public.get_renewal_credentials(uuid) from public, anon;
revoke all on function public.set_renewal_credentials(uuid, text, text, text, text, text, text, text, integer) from public, anon;
revoke all on function public.tg_recompute_amc_hours() from public, anon;
revoke all on function public.tg_handle_new_auth_user() from public, anon;

grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_active_user(uuid) to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.get_renewal_credentials(uuid) to authenticated;
grant execute on function public.set_renewal_credentials(uuid, text, text, text, text, text, text, text, integer) to authenticated;