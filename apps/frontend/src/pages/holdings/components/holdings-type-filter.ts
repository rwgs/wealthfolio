import { HoldingType } from "@/lib/constants";
import type { Holding } from "@/lib/types";

export const CASH_HOLDING_TYPE_KEY = "CASH";

export interface HoldingTypeFilterOption {
  value: string;
  fallbackLabel: string;
}

export function getHoldingTypeFilterValue(holding: Holding): string | undefined {
  if (holding.holdingType === HoldingType.CASH) {
    return CASH_HOLDING_TYPE_KEY;
  }

  return holding.instrument?.classifications?.assetType?.key;
}

export function getHoldingTypeFilterOption(
  holding: Holding,
  cashLabel: string,
): HoldingTypeFilterOption | undefined {
  if (holding.holdingType === HoldingType.CASH) {
    return { value: CASH_HOLDING_TYPE_KEY, fallbackLabel: cashLabel };
  }

  const assetType = holding.instrument?.classifications?.assetType;
  return assetType ? { value: assetType.key, fallbackLabel: assetType.name } : undefined;
}

export function getHoldingTypeTranslationKey(value: string): string {
  return `holdings:instrument_types.${value}`;
}

export function filterHoldingsByType(holdings: Holding[], selectedTypes: string[]): Holding[] {
  if (selectedTypes.length === 0) return holdings;

  const selectedTypeSet = new Set(selectedTypes);
  return holdings.filter((holding) => {
    const type = getHoldingTypeFilterValue(holding);
    return type ? selectedTypeSet.has(type) : false;
  });
}
