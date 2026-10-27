// Budget comune: lettura e scrittura su Supabase (tabelle shared_*, visibili solo a chi fa parte del budget).
import type { SExpense, SMember, SSettlement, SplitMode } from '../engine'
import { scopedClient } from '../sync/scopedClient'
import { currentScope } from '../store/scope'

export interface SBudget { id: string; name: string; currency: string; split_mode: Exclude<SplitMode, 'payer'>; created_by: string }
export interface SFull { budget: SBudget; members: SMember[]; expenses: SExpense[]; settlements: SSettlement[] }

export function sharedApi(lease = currentScope()) {
  const sb = () => { lease.assert(); const client = scopedClient(lease); if (!client) throw new Error('offline'); return client }
  const check = <T,>(r: { data: T; error: unknown }) => { lease.assert(); if (r.error) throw r.error; return r.data }

  async function myBudgets(): Promise<SBudget[]> {
    return check(await sb().from('shared_budgets').select('id, name, currency, split_mode, created_by').order('created_at')) ?? []
  }

  async function loadBudget(id: string): Promise<SFull> {
    const [b, m, e, s] = await Promise.all([
      sb().from('shared_budgets').select('id, name, currency, split_mode, created_by').eq('id', id).single(),
      sb().from('shared_members').select('user_id, display_name, income, share').eq('budget_id', id).order('joined_at'),
      sb().from('shared_expenses').select('id, paid_by, date, description, amount, category, split').eq('budget_id', id).order('date', { ascending: false }).limit(500),
      sb().from('shared_settlements').select('id, from_user, to_user, amount, date').eq('budget_id', id).order('date', { ascending: false }),
    ])
    const num = (x: unknown) => (x == null ? null : Number(x))
    return {
      budget: check(b) as SBudget,
      members: (check(m) ?? []).map(x => ({ ...x, income: num(x.income), share: num(x.share) })) as SMember[],
      expenses: (check(e) ?? []).map(x => ({ ...x, amount: Number(x.amount) })) as SExpense[],
      settlements: (check(s) ?? []).map(x => ({ ...x, amount: Number(x.amount) })) as SSettlement[],
    }
  }

  async function createBudget(name: string, currency: string, displayName: string): Promise<string> {
    return check(await sb().rpc('create_shared_budget', { p_name: name, p_currency: currency, p_display_name: displayName })) as string
  }
  async function createInvite(budgetId: string): Promise<string> {
    return check(await sb().rpc('create_shared_invite', { p_budget: budgetId })) as string
  }
  async function joinBudget(code: string, displayName: string): Promise<string> {
    return check(await sb().rpc('join_shared_budget', { p_code: code, p_display_name: displayName })) as string
  }
  async function updateBudget(id: string, patch: Partial<Pick<SBudget, 'name' | 'split_mode'>>) {
    check(await sb().from('shared_budgets').update(patch).eq('id', id))
  }
  async function updateMember(budgetId: string, userId: string, patch: Partial<Pick<SMember, 'display_name' | 'income' | 'share'>>) {
    check(await sb().from('shared_members').update(patch).eq('budget_id', budgetId).eq('user_id', userId))
  }
  async function leaveBudget(budgetId: string, userId: string) {
    check(await sb().from('shared_members').delete().eq('budget_id', budgetId).eq('user_id', userId))
  }
  async function saveExpense(budgetId: string, e: Omit<SExpense, 'id'> & { id?: string }) {
    const row = { budget_id: budgetId, paid_by: e.paid_by, date: e.date, description: e.description, amount: e.amount,
      category: e.category, split: e.split, updated_at: new Date().toISOString() }
    if (e.id) check(await sb().from('shared_expenses').update(row).eq('id', e.id))
    else check(await sb().from('shared_expenses').insert(row))
  }
  async function deleteExpense(id: string) {
    check(await sb().from('shared_expenses').delete().eq('id', id))
  }
  async function settle(budgetId: string, from: string, to: string, amount: number) {
    check(await sb().from('shared_settlements').insert({ budget_id: budgetId, from_user: from, to_user: to, amount }))
  }

  return { myBudgets, loadBudget, createBudget, createInvite, joinBudget, updateBudget, updateMember, leaveBudget, saveExpense, deleteExpense, settle }
}
