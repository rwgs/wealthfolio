import { describe, expect, it } from "vitest";
import type { RetirementIncomeStream, RetirementPlan } from "../types";
import {
  deriveRetirementReadiness,
  netAnnualReturn,
  planAccumulationReturn,
  projectedAnnualIncomeNominalAtAge,
  resolveCoverageAnnualNominalValues,
  resolveFundedProgress,
  resolvePortfolioDrawRate,
} from "./dashboard-math";
import { DEFAULT_DC_PAYOUT_ESTIMATE_RATE } from "./constants";
import { DEFAULT_RETIREMENT_PLAN } from "./plan-adapter";

function planWithFund(stream: Partial<RetirementIncomeStream>): RetirementPlan {
  return {
    ...DEFAULT_RETIREMENT_PLAN,
    personal: { ...DEFAULT_RETIREMENT_PLAN.personal, currentAge: 45, targetRetirementAge: 65 },
    incomeStreams: [
      {
        id: "fund",
        label: "Pension fund",
        streamType: "dc",
        startAge: 65,
        adjustForInflation: false,
        currentValue: 120_000,
        accumulationReturn: 0,
        ...stream,
      },
    ],
  };
}

describe("retirement dashboard math", () => {
  it("does not inflate backend nominal budget fallback values again", () => {
    const values = resolveCoverageAnnualNominalValues({
      totalMonthlyBudget: 1_000,
      fallbackMonthlyIncome: 400,
      effectiveTaxRate: 0.25,
    });

    expect(values.annualSpendingNominal).toBe(12_000);
    expect(values.annualIncomeNominal).toBe(4_800);
    expect(values.annualPortfolioGapNominal).toBe(7_200);
    expect(values.annualGrossWithdrawalNominal).toBe(9_600);
    expect(values.annualEstimatedTaxesNominal).toBe(2_400);
  });

  it("uses fire-phase snapshot values directly when available", () => {
    const values = resolveCoverageAnnualNominalValues({
      snapshot: {
        phase: "fire",
        plannedExpenses: 15_000,
        annualIncome: 5_000,
        netWithdrawalFromPortfolio: 10_000,
        grossWithdrawal: 11_000,
        annualTaxes: 1_000,
      },
      totalMonthlyBudget: 99_999,
      fallbackMonthlyIncome: 99_999,
      effectiveTaxRate: 0.25,
    });

    expect(values.annualSpendingNominal).toBe(15_000);
    expect(values.annualIncomeNominal).toBe(5_000);
    expect(values.annualPortfolioGapNominal).toBe(10_000);
    expect(values.annualGrossWithdrawalNominal).toBe(11_000);
    expect(values.annualEstimatedTaxesNominal).toBe(1_000);
  });

  it("keeps funded progress independent from today's-value versus nominal display mode", () => {
    expect(resolveFundedProgress(0.25, 500_000, 1_000_000)).toBe(0.25);
    expect(resolveFundedProgress(0.25, 500_000, 2_000_000)).toBe(0.25);
    expect(resolveFundedProgress(undefined, 500_000, 1_000_000)).toBe(0.5);
    expect(resolveFundedProgress(1.2, 500_000, 1_000_000)).toBe(1);
    expect(resolveFundedProgress(-0.2, 500_000, 1_000_000)).toBe(0);
  });

  it("derives deterministic readiness without conflating spending gaps and depletion", () => {
    expect(
      deriveRetirementReadiness({
        overview: { requiredCapitalReachable: false },
        plannerMode: "traditional",
        isFinanciallyIndependent: false,
        effectiveFiAge: null,
        desiredAge: 65,
        horizonAge: 90,
      }),
    ).toMatchObject({ tone: "bad", problem: "unreachable-target" });

    expect(
      deriveRetirementReadiness({
        overview: { requiredCapitalReachable: true, spendingShortfallAge: 78 },
        plannerMode: "traditional",
        isFinanciallyIndependent: false,
        effectiveFiAge: null,
        desiredAge: 65,
        horizonAge: 90,
      }),
    ).toMatchObject({ tone: "watch", problem: "spending-gap" });

    expect(
      deriveRetirementReadiness({
        overview: { requiredCapitalReachable: true, failureAge: 83 },
        plannerMode: "traditional",
        isFinanciallyIndependent: false,
        effectiveFiAge: null,
        desiredAge: 65,
        horizonAge: 90,
      }),
    ).toMatchObject({ tone: "bad", problem: "portfolio-depletion" });

    expect(
      deriveRetirementReadiness({
        overview: { requiredCapitalReachable: true, spendingShortfallAge: 78, failureAge: 83 },
        plannerMode: "traditional",
        isFinanciallyIndependent: false,
        effectiveFiAge: null,
        desiredAge: 65,
        horizonAge: 90,
      }),
    ).toMatchObject({ tone: "bad", problem: "portfolio-depletion" });
  });

  it("grows a fund with no return of its own at the plan rate net of fees", () => {
    // The engine's fallback is `plan_accumulation_return`, which is net of the
    // investment fee. The preview used the gross assumption, so the two
    // disagreed by the fee drag for any fund that never set its own return.
    const plan = planWithFund({ accumulationReturn: undefined });
    const net = planAccumulationReturn(plan);

    expect(net).toBeLessThan(plan.investment.preRetirementAnnualReturn);
    expect(net).toBeCloseTo(
      netAnnualReturn(
        plan.investment.preRetirementAnnualReturn,
        plan.investment.annualInvestmentFeeRate,
      ),
      12,
    );

    const balanceAt65 = 120_000 * Math.pow(1 + net, 20);
    expect(projectedAnnualIncomeNominalAtAge(plan, 65, 65)).toBeCloseTo(
      balanceAt65 * DEFAULT_DC_PAYOUT_ESTIMATE_RATE,
      4,
    );
  });

  it("draws fund income at the stream's payout rate, defaulting to 3.5%/yr", () => {
    expect(projectedAnnualIncomeNominalAtAge(planWithFund({}), 65, 65)).toBeCloseTo(4_200, 6);
    expect(
      projectedAnnualIncomeNominalAtAge(planWithFund({ payoutRate: 0.06 }), 65, 65),
    ).toBeCloseTo(7_200, 6);
  });

  it("shows portfolio draw rate only when meaningful", () => {
    expect(
      resolvePortfolioDrawRate({
        requiredCapitalReachable: true,
        portfolioValueAtAge: 1_000_000,
        grossWithdrawalAtAge: 45_000,
        annualIncomeAtAge: 12_000,
        annualSpendingAtAge: 60_000,
        portfolioEndAtAge: 990_000,
      }),
    ).toBe(0.045);

    expect(
      resolvePortfolioDrawRate({
        requiredCapitalReachable: false,
        portfolioValueAtAge: 1_000_000,
        grossWithdrawalAtAge: 45_000,
        annualIncomeAtAge: 12_000,
        annualSpendingAtAge: 60_000,
        portfolioEndAtAge: 990_000,
      }),
    ).toBeNull();

    expect(
      resolvePortfolioDrawRate({
        requiredCapitalReachable: true,
        portfolioValueAtAge: 1_000_000,
        grossWithdrawalAtAge: 2_000,
        annualIncomeAtAge: 57_000,
        annualSpendingAtAge: 60_000,
        portfolioEndAtAge: 990_000,
      }),
    ).toBeNull();

    expect(
      resolvePortfolioDrawRate({
        requiredCapitalReachable: true,
        portfolioValueAtAge: 1_000_000,
        grossWithdrawalAtAge: 45_000,
        annualIncomeAtAge: 12_000,
        annualSpendingAtAge: 60_000,
        portfolioEndAtAge: 0,
      }),
    ).toBeNull();
  });
});
