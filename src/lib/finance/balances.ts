import { add, sum, type Cents } from "@/lib/money";
import { addDays, type ISODate } from "@/lib/dates";
import type { Account, Transaction } from "@/lib/db/types";

/** Jen platné (nestornované) transakce. Storno se nikdy nezapočítává. */
export function posted(txs: readonly Transaction[]): Transaction[] {
  return txs.filter((t) => t.status === "posted");
}

/**
 * Vliv transakce na zůstatek daného účtu.
 * Příjem +, výdaj −, převod: zdrojový účet −, cílový +.
 */
export function effectOnAccount(t: Transaction, accountId: string): Cents {
  if (t.status !== "posted") return 0;
  if (t.type === "income") return t.account_id === accountId ? t.amount : 0;
  if (t.type === "expense") return t.account_id === accountId ? -t.amount : 0;
  // transfer
  if (t.account_id === accountId && t.transfer_account_id === accountId) return 0;
  if (t.account_id === accountId) return -t.amount;
  if (t.transfer_account_id === accountId) return t.amount;
  return 0;
}

/**
 * Zůstatek účtu k datu (včetně).
 * Počáteční zůstatek platí k datu `opening_date` a ZAHRNUJE všechny pohyby
 * před tímto datem – transakce starší než opening_date se proto nepočítají
 * (jinak by např. importovaná historie z banky byla započtena dvakrát).
 */
export function accountBalance(account: Account, txs: readonly Transaction[], asOf: ISODate): Cents {
  if (asOf < account.opening_date) return 0;
  return add(
    account.opening_balance,
    sum(
      txs.filter((t) => t.date >= account.opening_date && t.date <= asOf),
      (t) => effectOnAccount(t, account.id),
    ),
  );
}

export interface BalanceSummary {
  byAccount: Record<string, Cents>;
  total: Cents;
  /** Účty, které se počítají do disponibilních peněz (běžné účty, hotovost). */
  liquid: Cents;
  /** Spořicí účty a jiné, které do disponibilních peněz nepatří. */
  nonLiquid: Cents;
}

export function balances(accounts: readonly Account[], txs: readonly Transaction[], asOf: ISODate): BalanceSummary {
  const byAccount: Record<string, Cents> = {};
  let total = 0, liquid = 0, nonLiquid = 0;
  for (const a of accounts) {
    const b = accountBalance(a, txs, asOf);
    byAccount[a.id] = b;
    if (!a.is_active && b === 0) continue;
    total = add(total, b);
    if (a.include_in_available) liquid = add(liquid, b);
    else nonLiquid = add(nonLiquid, b);
  }
  return { byAccount, total, liquid, nonLiquid };
}

/** Denní vývoj celkového zůstatku (pro graf). */
export function balanceSeries(
  accounts: readonly Account[],
  txs: readonly Transaction[],
  from: ISODate,
  to: ISODate,
): { date: ISODate; total: Cents; liquid: Cents }[] {
  const out: { date: ISODate; total: Cents; liquid: Cents }[] = [];
  const p = posted(txs);
  // inkrementálně: zůstatek k `from` a pak denní změny
  const state: Record<string, Cents> = {};
  for (const a of accounts) state[a.id] = accountBalance(a, p, from);
  const byDate = new Map<ISODate, Transaction[]>();
  for (const t of p) {
    if (t.date > from && t.date <= to) {
      const list = byDate.get(t.date) ?? [];
      list.push(t);
      byDate.set(t.date, list);
    }
  }
  const opening = new Map<ISODate, Account[]>();
  for (const a of accounts) {
    if (a.opening_date > from && a.opening_date <= to) {
      const list = opening.get(a.opening_date) ?? [];
      list.push(a);
      opening.set(a.opening_date, list);
    }
  }
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (d !== from) {
      for (const a of opening.get(d) ?? []) state[a.id] = a.opening_balance;
      for (const t of byDate.get(d) ?? []) {
        for (const a of accounts) {
          if (d >= a.opening_date) state[a.id] = add(state[a.id], effectOnAccount(t, a.id));
        }
      }
    }
    let total = 0, liquid = 0;
    for (const a of accounts) {
      total = add(total, state[a.id]);
      if (a.include_in_available) liquid = add(liquid, state[a.id]);
    }
    out.push({ date: d, total, liquid });
  }
  return out;
}
