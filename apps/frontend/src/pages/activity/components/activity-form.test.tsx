import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityType } from "@/lib/constants";
import type { AccountSelectOption } from "./forms/fields";
import { ActivityForm } from "./activity-form";

const { useActivityFormMock } = vi.hoisted(() => ({
  useActivityFormMock: vi.fn(),
}));

vi.mock("../hooks/use-activity-form", () => ({
  useActivityForm: (params: unknown) => useActivityFormMock(params),
}));

vi.mock("./activity-form-renderer", () => ({
  ActivityFormRenderer: ({ accounts }: { accounts: AccountSelectOption[] }) => (
    <div data-testid="rendered-account-ids">
      {accounts.map((account) => account.value).join(",")}
    </div>
  ),
}));

vi.mock("./activity-type-picker", () => ({
  ActivityTypePicker: () => null,
}));

const accounts: AccountSelectOption[] = [
  {
    value: "current-account",
    label: "Current account",
    currency: "USD",
    restrictionLevel: "blocked",
  },
  {
    value: "eligible-account",
    label: "Eligible account",
    currency: "USD",
    restrictionLevel: "none",
  },
  {
    value: "other-blocked-account",
    label: "Other blocked account",
    currency: "USD",
    restrictionLevel: "blocked",
  },
];

describe("ActivityForm account filtering", () => {
  beforeEach(() => {
    useActivityFormMock.mockReturnValue({
      defaultValues: undefined,
      isLoading: false,
      isError: false,
      error: null,
      handleSubmit: vi.fn(),
    });
  });

  it("keeps the activity's current restricted account available while editing", () => {
    render(
      <ActivityForm
        open
        accounts={accounts}
        activity={{
          id: "credit-activity",
          accountId: "current-account",
          activityType: ActivityType.CREDIT,
        }}
      />,
    );

    expect(screen.getByTestId("rendered-account-ids")).toHaveTextContent(
      "current-account,eligible-account",
    );
  });

  it("continues to exclude restricted accounts when creating an activity", () => {
    render(
      <ActivityForm open accounts={accounts} activity={{ activityType: ActivityType.CREDIT }} />,
    );

    expect(screen.getByTestId("rendered-account-ids")).toHaveTextContent("eligible-account");
  });
});
