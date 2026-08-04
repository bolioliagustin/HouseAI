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
  total: number;
  netDebt: number;
};

/**
 * Fair-share spending: every split counts toward member totals regardless of is_paid.
 * is_paid only drives netDebt (settlement), so marking paid never changes Total casa.
 */
export function computeMemberSpending(
  members: { user_id: string; name: string }[],
  expenses: SharedExpenseForSpending[]
): MemberSpending[] {
  const spendingMap = new Map<string, { name: string; total: number; netDebt: number }>();

  members.forEach((m) => {
    spendingMap.set(m.user_id, {
      name: m.name,
      total: 0,
      netDebt: 0,
    });
  });

  expenses.forEach((exp) => {
    const splits = exp.expense_splits || [];

    if (splits.length > 0) {
      splits.forEach((split) => {
        const memberEntry = spendingMap.get(split.user_id);
        if (memberEntry) {
          spendingMap.set(split.user_id, {
            ...memberEntry,
            total: memberEntry.total + Number(split.amount),
          });
        }
      });
    } else {
      const current = spendingMap.get(exp.paid_by);
      if (current) {
        spendingMap.set(exp.paid_by, {
          ...current,
          total: current.total + Number(exp.total_amount),
        });
      }
    }

    if (exp.is_shared && exp.paid_by) {
      const unpaidSplits = splits.filter((s) => !s.is_paid && s.user_id !== exp.paid_by);
      unpaidSplits.forEach((split) => {
        const debtor = spendingMap.get(split.user_id);
        if (debtor) {
          spendingMap.set(split.user_id, {
            ...debtor,
            netDebt: debtor.netDebt + split.amount,
          });
        }
        const creditor = spendingMap.get(exp.paid_by);
        if (creditor) {
          spendingMap.set(exp.paid_by, {
            ...creditor,
            netDebt: creditor.netDebt - split.amount,
          });
        }
      });
    }
  });

  return Array.from(spendingMap.entries()).map(([user_id, data]) => ({
    user_id,
    name: data.name,
    total: data.total,
    netDebt: data.netDebt,
  }));
}

export function totalHouseSpending(memberSpending: { total: number }[]): number {
  return memberSpending.reduce((sum, m) => sum + m.total, 0);
}
