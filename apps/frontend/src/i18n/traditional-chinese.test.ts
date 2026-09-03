import { describe, expect, it } from "vitest";
import { NAMESPACES } from "./locales";

type Translation = string | { [key: string]: Translation };

const english = import.meta.glob<Translation>("./locales/en/*.json", {
  eager: true,
  import: "default",
});
const traditionalChinese = import.meta.glob<Translation>("./locales/zh-Hant/*.json", {
  eager: true,
  import: "default",
});

function flatten(value: Translation, prefix = ""): Map<string, string> {
  if (typeof value === "string") return new Map([[prefix, value]]);

  return new Map(
    Object.entries(value).flatMap(([key, nested]) => [
      ...flatten(nested, prefix ? `${prefix}.${key}` : key).entries(),
    ]),
  );
}

function interpolations(value: string) {
  return [...value.matchAll(/{{[^}]+}}/g)].map((match) => match[0]).sort();
}

/** Every zh-Hant string as `namespace:key` -> value, for whole-catalog sweeps. */
const allStrings = new Map<string, string>(
  Object.entries(traditionalChinese).flatMap(([path, translation]) => {
    const namespace = path.replace("./locales/zh-Hant/", "").replace(".json", "");
    return [...flatten(translation).entries()].map(
      ([key, value]) => [`${namespace}:${key}`, value] as const,
    );
  }),
);

function offenders(term: string, allowed: ReadonlySet<string> = new Set()) {
  return [...allStrings]
    .filter(([key, value]) => value.includes(term) && !allowed.has(key))
    .map(([key, value]) => `${key} = ${value}`);
}

/**
 * The house glossary for this catalog.
 *
 * A denylist only catches variants somebody already thought of; this asserts the
 * term we standardised on is present and its known alternates are absent, so a
 * later contributor cannot reintroduce a second word for the same concept. Worth
 * having because none of this is visible to the checks that already exist — the
 * catalog can have perfect key parity, pass every other test, and still say
 * "Return" three different ways.
 *
 * `use` is Taiwan financial/industry register; `insteadOf` are Mainland register
 * or a different sense of the word in Taiwan usage.
 */
const GLOSSARY: readonly {
  concept: string;
  use: string;
  insteadOf: readonly string[];
  note?: string;
}[] = [
  { concept: "Return", use: "報酬", insteadOf: ["回報"], note: "回報 means 'to reciprocate'" },
  { concept: "Type", use: "類型", insteadOf: ["型別"], note: "型別 is a *data* type" },
  { concept: "Plan", use: "計畫", insteadOf: ["計劃"] },
  { concept: "P&L", use: "損益", insteadOf: ["盈虧"] },
  { concept: "Performance", use: "績效", insteadOf: ["業績"] },
  { concept: "Required field", use: "必填欄位", insteadOf: ["必填項"] },
  { concept: "Item", use: "項目", insteadOf: [] },
  { concept: "Yield", use: "殖利率", insteadOf: ["股息率", "收益率"] },
  { concept: "Brokerage fee", use: "手續費", insteadOf: ["傭金", "佣金"] },
  { concept: "Stock split", use: "股票分割", insteadOf: ["拆股"] },
  { concept: "Inflation", use: "通膨", insteadOf: ["通脹"] },
  { concept: "Contribution", use: "提撥", insteadOf: ["供款"] },
];

/**
 * Simplified-register words that are never right here, whatever the context.
 * Most are OpenCC `s2twp` artifacts — a Simplified->Traditional converter
 * mistranslating a software term rather than a financial one.
 */
const MAINLAND_REGISTER = [
  "賬",
  "數據",
  "默認",
  "創建",
  "自定義",
  "添加",
  "獲取",
  "點選",
  "程式碼",
  "例項",
  "對映",
  "許可權",
  "作用域",
  "高階",
  "儀表盤",
  "退出登入",
  "軟件",
  "信息",
  "網絡",
  "視頻",
  "登錄",
  "菜單",
  "缺省",
  "意大利",
];

describe("Traditional Chinese translations", () => {
  it("matches every English namespace, key, and interpolation", () => {
    expect(Object.keys(traditionalChinese)).toHaveLength(NAMESPACES.length);

    for (const namespace of NAMESPACES) {
      const englishFile = flatten(english[`./locales/en/${namespace}.json`]);
      const traditionalChineseFile = flatten(
        traditionalChinese[`./locales/zh-Hant/${namespace}.json`],
      );

      expect([...traditionalChineseFile.keys()].sort()).toEqual([...englishFile.keys()].sort());

      for (const [key, source] of englishFile) {
        expect(interpolations(traditionalChineseFile.get(key) ?? "")).toEqual(
          interpolations(source),
        );
      }
    }
  });

  it.each(GLOSSARY)("says $concept as $use everywhere", ({ use, insteadOf, note }) => {
    expect(offenders(use).length, `expected the catalog to use ${use}`).toBeGreaterThan(0);

    for (const alternate of insteadOf) {
      const found = offenders(alternate);
      expect(found, `use ${use}${note ? ` — ${note}` : ""}:\n  ${found.join("\n  ")}`).toEqual([]);
    }
  });

  it("uses Taiwan register, not Simplified-Chinese register", () => {
    for (const term of MAINLAND_REGISTER) {
      expect(offenders(term), `Mainland register: ${term}`).toEqual([]);
    }
  });

  it("uses Taiwan corner-bracket quotation marks", () => {
    expect(offenders("“")).toEqual([]);
    expect(offenders("”")).toEqual([]);
  });

  it("keeps 表現 for the verb sense only", () => {
    // "How is my portfolio performing?" is a verb; a Performance *metric* is 績效.
    // 代表現金 ("represents cash") is an unrelated substring and must survive too.
    expect(offenders("表現").length).toBeLessThanOrEqual(3);
    expect(allStrings.get("ai:thread.suggestions.performance")).toContain("表現");
    expect(allStrings.get("common:performance")).toBe("績效");
  });

  it("labels trade cash totals as payable and receivable, not ledger sides", () => {
    // These label the final cash on a trade form, not a double-entry ledger.
    expect(allStrings.get("activity:form.total_debit")).toBe("應付總額");
    expect(allStrings.get("activity:form.total_credit")).toBe("應收總額");
    // The help text describes cash paid and received, which is what makes
    // 借方/貸方 the wrong label for the field above it.
    expect(allStrings.get("activity:form.help_total_debit")).toContain("支付");
    expect(allStrings.get("activity:form.help_total_credit")).toContain("收到");
    expect(allStrings.get("activity:type_credit")).toBe("入帳");
  });

  it("uses the correct stock-split direction in the help text", () => {
    expect(allStrings.get("activity:type_split_desc")).toContain("1 拆 2");
  });

  it("keeps nominal values distinct from inflation-adjusted values", () => {
    expect(allStrings.get("goals:dashboard.value_mode.nominal_tip")).toContain("包含通膨影響");
  });

  it("keeps rebuild wording valid", () => {
    expect(allStrings.get("settings:accounts.mode_switch_description")).toContain("重新建構");
    expect(allStrings.get("settings:fx_delete_warning")).toContain("重新建立");
  });

  it("labels retirement capital inputs accurately", () => {
    expect(allStrings.get("goals:dashboard.progress.capital_needed_tip_traditional")).toContain(
      "已納入",
    );
    expect(allStrings.get("goals:dashboard.progress.capital_needed_tip_fire")).toContain("已納入");
  });
});
