import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@wealthfolio/ui/components/ui/data-table";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

interface TestHolding {
  symbol: string;
  holdingType: string;
}

const columns: ColumnDef<TestHolding>[] = [
  {
    accessorKey: "symbol",
    header: "Symbol",
    cell: ({ getValue }) => <span data-testid="symbol-cell">{getValue<string>()}</span>,
  },
  { accessorKey: "holdingType", header: "Type" },
];

describe("holdings desktop toolbar", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("orders status before search and keeps display controls on the right", () => {
    const { container } = render(
      <DataTable
        data={[{ symbol: "VOO", holdingType: "ETF" }]}
        columns={columns}
        searchBy="symbol"
        filters={[
          {
            id: "holdingType",
            title: "Type",
            options: [{ value: "ETF", label: "ETF" }],
          },
        ]}
        toolbarView={<button data-testid="position-status">Open | Closed</button>}
        toolbarActions={<button>Currency</button>}
        showColumnToggle
      />,
    );

    const controls = Array.from(container.querySelectorAll("button, input"));
    const status = screen.getByTestId("position-status");
    const search = screen.getByRole("textbox");
    const type = screen.getByRole("button", { name: "Type" });
    const currency = screen.getByRole("button", { name: "Currency" });
    const columnToggle = screen.getByRole("button", { name: /Columns/ });

    expect(controls.indexOf(status)).toBeLessThan(controls.indexOf(search));
    expect(controls.indexOf(search)).toBeLessThan(controls.indexOf(type));
    expect(controls.indexOf(type)).toBeLessThan(controls.indexOf(currency));
    expect(controls.indexOf(currency)).toBeLessThan(controls.indexOf(columnToggle));
  });

  it("replaces sorting for a removed view column with the default", async () => {
    window.localStorage.setItem(
      "holdings-sorting-test:sorting",
      JSON.stringify([{ id: "marketValue", desc: true }]),
    );

    render(
      <DataTable
        data={[
          { symbol: "ZZZ", holdingType: "ETF" },
          { symbol: "AAA", holdingType: "STOCK" },
        ]}
        columns={columns}
        defaultSorting={[{ id: "symbol", desc: false }]}
        storageKey="holdings-sorting-test"
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByTestId("symbol-cell").map((cell) => cell.textContent)).toEqual([
        "AAA",
        "ZZZ",
      ]);
    });

    expect(
      JSON.parse(window.localStorage.getItem("holdings-sorting-test:sorting") ?? "[]"),
    ).toEqual([{ id: "symbol", desc: false }]);
  });
});
