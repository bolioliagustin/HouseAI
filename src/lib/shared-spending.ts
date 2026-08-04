export type ExpenseSplit = {
  amount: number;
  is_paid: boolean;
  user_id: string;
};

export type SharedExpenseForSpending = {
  paid_by: string;
  total_amount: number;
  is_shared?: boolean | null;
  expense_splits?: ExpenseSplit[] | null;
};

export type MemberSpending = {
  user_id: string;
  name: string;
  /** Cash paid on aporte (no-split) house expenses */
  outlayTotal: number;
  /** Fair-share attribution from dividir expenses */
  fairShareTotal: number;
  /** @deprecated Prefer outlayTotal + fairShareTotal; kept as outlay + fair share */
  total: number;
  /** Net settlement: >0 owes, <0 is owed */
  netDebt: number;
};

/**
 * House account math:
 * - Aporte (no splits): counts toward outlayTotal for paid_by. No debt.
 * - Dividir (has splits): fairShareTotal per member; unpaid non-payer splits drive netDebt.
 */
export function computeMemberSpending(
  members: { user_id: string; name: string }[],
  expenses: SharedExpenseForSpending[]
): MemberSpending[] {
  const spendingMap = new Map<
    string,
    { name: string; outlayTotal: number; fairShareTotal: number; netDebt: number }
  >();

  members.forEach((m) => {
    spendingMap.set(m.user_id, {
      name: m.name,
      outlayTotal: 0,
      fairShareTotal: 0,
      netDebt: 0,
    });
  });

  expenses.forEach((exp) => {
    const splits = exp.expense_splits || [];

    if (splits.length > 0) {
      // Dividir: attribute fair share; settlement via unpaid splits
      splits.forEach((split) => {
        const memberEntry = spendingMap.get(split.user_id);
        if (memberEntry) {
          spendingMap.set(split.user_id, {
            ...memberEntry,
            fairShareTotal: memberEntry.fairShareTotal + Number(split.amount),
          });
        }
      });
    } else if (exp.paid_by) {
      // Aporte: cash outlay only, no debt
      const current = spendingMap.get(exp.paid_by);
      if (current) {
        spendingMap.set(exp.paid_by, {
          ...current,
          outlayTotal: current.outlayTotal + Number(exp.total_amount),
        });
      }
    }

    if (exp.is_shared && exp.paid_by && splits.length > 0) {
      const unpaidSplits = splits.filter((s) => !s.is_paid && s.user_id !== exp.paid_by);
      unpaidSplits.forEach((split) => {
        const debtor = spendingMap.get(split.user_id);
        if (debtor) {
          spendingMap.set(split.user_id, {
            ...debtor,
            netDebt: debtor.netDebt + Number(split.amount),
          });
        }
        const creditor = spendingMap.get(exp.paid_by);
        if (creditor) {
          spendingMap.set(exp.paid_by, {
            ...creditor,
            netDebt: creditor.netDebt - Number(split.amount),
          });
        }
      });
    }
  });

  return Array.from(spendingMap.entries()).map(([user_id, data]) => ({
    user_id,
    name: data.name,
    outlayTotal: data.outlayTotal,
    fairShareTotal: data.fairShareTotal,
    total: data.outlayTotal + data.fairShareTotal,
    netDebt: data.netDebt,
  }));
}

export function totalHouseSpending(memberSpending: { total: number }[]): number {
  return memberSpending.reduce((sum, m) => sum + m.total, 0);
}

export function totalOutlays(memberSpending: { outlayTotal: number }[]): number {
  return memberSpending.reduce((sum, m) => sum + m.outlayTotal, 0);
}

/** Who put more cash in aportes vs equal share. */
export function aporteBalanceSummary(memberSpending: MemberSpending[]): {
  totalOutlay: number;
  equalShare: number;
  leader: MemberSpending | null;
  gap: number;
  isBalanced: boolean;
} {
  const totalOutlay = totalOutlays(memberSpending);
  const n = memberSpending.length || 1;
  const equalShare = totalOutlay / n;
  if (totalOutlay < 0.01) {
    return { totalOutlay: 0, equalShare: 0, leader: null, gap: 0, isBalanced: true };
  }
  const leader = [...memberSpending].sort((a, b) => b.outlayTotal - a.outlayTotal)[0] || null;
  const gap = leader ? leader.outlayTotal - equalShare : 0;
  return {
    totalOutlay,
    equalShare,
    leader,
    gap,
    isBalanced: gap < 0.01,
  };
}

/** Person-to-person settlement line for the current user. */
export function settlementForUser(
  memberSpending: MemberSpending[],
  myUserId: string
): {
  myNetDebt: number;
  counterpart: MemberSpending | null;
  label: string | null;
} {
  const me = memberSpending.find((m) => m.user_id === myUserId);
  const myNetDebt = me?.netDebt ?? 0;
  if (Math.abs(myNetDebt) < 0.01) {
    return { myNetDebt: 0, counterpart: null, label: null };
  }

  // Prefer the member with opposite-signed debt (typical 2-person house)
  const counterpart =
    memberSpending.find(
      (m) =>
        m.user_id !== myUserId &&
        Math.sign(m.netDebt) === -Math.sign(myNetDebt) &&
        Math.abs(m.netDebt) > 0.01
    ) ||
    memberSpending.find((m) => m.user_id !== myUserId) ||
    null;

  const otherName = counterpart?.name || "la casa";
  const amount = Math.abs(myNetDebt).toLocaleString("es-AR");

  if (myNetDebt > 0) {
    return {
      myNetDebt,
      counterpart,
      label: `Le debés $${amount} a ${otherName}`,
    };
  }
  return {
    myNetDebt,
    counterpart,
    label: `${otherName} te debe $${amount}`,
  };
}
