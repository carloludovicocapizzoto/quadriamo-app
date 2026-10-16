-- Budget comuni (0010), regole più strette dopo il controllo di sicurezza del 16/10/2026.
-- Prima chi era nel budget poteva modificare qualsiasi colonna: per esempio diventarne il creatore (e poterlo
-- eliminare), spostare un'altra persona in un altro budget o sostituirla con un altro utente.
-- Ora si cambia solo quello che l'app cambia davvero:
--   budget: nome e modo di dividere le spese;
--   membri: le quote (si decidono insieme), mentre nome e entrate solo nella propria riga.
-- Rieseguire non cambia niente.

revoke update on public.shared_budgets from authenticated;
grant update (name, split_mode) on public.shared_budgets to authenticated;

revoke update on public.shared_members from authenticated;
grant update (display_name, income, share) on public.shared_members to authenticated;

create or replace function public.shared_member_own_fields() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.user_id is distinct from auth.uid()
     and (new.display_name is distinct from old.display_name or new.income is distinct from old.income) then
    raise exception 'Nome ed entrate li cambia solo la persona interessata';
  end if;
  return new;
end $$;

drop trigger if exists shared_member_own_fields on public.shared_members;
create trigger shared_member_own_fields before update on public.shared_members
  for each row execute function public.shared_member_own_fields();
