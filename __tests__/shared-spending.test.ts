import {
  aporteBalanceSummary,
  computeMemberSpending,
  settlementForUser,
  totalHouseSpending,
  totalOutlays,
} from "@/lib/shared-spending";

describe("computeMemberSpending (cuenta de casa)", () => {
  const members = [
    { user_id: "payer", name: "Alice" },
    { user_id: "debtor", name: "Bob" },
  ];

  const splitExpense = {
    paid_by: "payer",
    total_amount: 1000,
    is_shared: true,
    expense_splits: [
      { user_id: "payer", amount: 500, is_paid: true },
      { user_id: "debtor", amount: 500, is_paid: false },
    ],
  };

  const aporteExpense = {
    paid_by: "payer",
    total_amount: 800,
    is_shared: true,
    expense_splits: [] as { user_id: string; amount: number; is_paid: boolean }[],
  };

  it("counts dividir fair shares and net debt separately from aportes", () => {
    const spending = computeMemberSpending(members, [splitExpense]);

    expect(spending.find((m) => m.user_id === "payer")?.fairShareTotal).toBe(500);
    expect(spending.find((m) => m.user_id === "debtor")?.fairShareTotal).toBe(500);
    expect(spending.find((m) => m.user_id === "payer")?.outlayTotal).toBe(0);
    expect(totalHouseSpending(spending)).toBe(1000);
    expect(spending.find((m) => m.user_id === "debtor")?.netDebt).toBe(500);
    expect(spending.find((m) => m.user_id === "payer")?.netDebt).toBe(-500);
  });

  it("keeps fair shares stable when debtor marks paid (only clears debt)", () => {
    const settled = {
      ...splitExpense,
      expense_splits: [
        { user_id: "payer", amount: 500, is_paid: true },
        { user_id: "debtor", amount: 500, is_paid: true },
      ],
    };

    const before = computeMemberSpending(members, [splitExpense]);
    const after = computeMemberSpending(members, [settled]);

    expect(totalHouseSpending(after)).toBe(totalHouseSpending(before));
    expect(after.find((m) => m.user_id === "debtor")?.netDebt).toBe(0);
    expect(after.find((m) => m.user_id === "payer")?.netDebt).toBe(0);
  });

  it("attributes aporte outlay to payer with no debt", () => {
    const spending = computeMemberSpending(members, [aporteExpense]);

    expect(spending.find((m) => m.user_id === "payer")?.outlayTotal).toBe(800);
    expect(spending.find((m) => m.user_id === "debtor")?.outlayTotal).toBe(0);
    expect(spending.find((m) => m.user_id === "payer")?.netDebt).toBe(0);
    expect(spending.find((m) => m.user_id === "debtor")?.netDebt).toBe(0);
    expect(totalOutlays(spending)).toBe(800);
  });

  it("summarizes aporte balance and pairwise settlement", () => {
    const spending = computeMemberSpending(members, [aporteExpense, splitExpense]);
    const aportes = aporteBalanceSummary(spending);
    const settlement = settlementForUser(spending, "debtor");

    expect(aportes.leader?.user_id).toBe("payer");
    expect(aportes.gap).toBe(400);
    expect(aportes.isBalanced).toBe(false);
    expect(settlement.label).toBe("Le debés $500 a Alice");
  });
});
