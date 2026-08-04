import {
  computeMemberSpending,
  totalHouseSpending,
} from "@/lib/shared-spending";

describe("computeMemberSpending (fair share)", () => {
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

  it("counts every split toward totals when debt is unpaid", () => {
    const spending = computeMemberSpending(members, [splitExpense]);
    const houseTotal = totalHouseSpending(spending);

    expect(spending.find((m) => m.user_id === "payer")?.total).toBe(500);
    expect(spending.find((m) => m.user_id === "debtor")?.total).toBe(500);
    expect(houseTotal).toBe(1000);
    expect(spending.find((m) => m.user_id === "debtor")?.netDebt).toBe(500);
    expect(spending.find((m) => m.user_id === "payer")?.netDebt).toBe(-500);
  });

  it("keeps totals stable when debtor marks paid (only clears debt)", () => {
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
    expect(totalHouseSpending(after)).toBe(1000);
    expect(after.find((m) => m.user_id === "payer")?.total).toBe(500);
    expect(after.find((m) => m.user_id === "debtor")?.total).toBe(500);
    expect(after.find((m) => m.user_id === "debtor")?.netDebt).toBe(0);
    expect(after.find((m) => m.user_id === "payer")?.netDebt).toBe(0);
  });

  it("attributes full amount to payer when there are no splits", () => {
    const spending = computeMemberSpending(members, [
      {
        paid_by: "payer",
        total_amount: 800,
        is_shared: true,
        expense_splits: [],
      },
    ]);

    expect(spending.find((m) => m.user_id === "payer")?.total).toBe(800);
    expect(spending.find((m) => m.user_id === "debtor")?.total).toBe(0);
    expect(totalHouseSpending(spending)).toBe(800);
  });
});
