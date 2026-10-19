import {GRID_FAMILIES, FAMILY_DEFAULTS, freshFlowConfig, normalizeFlowConfig, flowRowItems} from './model';
import type {FlowConfig, GridFamily} from './model';

export const FAMILY_STORE_KEY = 'LaunchGrid.config.families.v1';
export const ACTIVE_FAMILY_KEY = 'LaunchGrid.activeFamily.v1';
export type FamilyConfigs = {version: 1; sizes: Record<GridFamily, FlowConfig>};
export type StoredFamilyConfigs = {version: 1; sizes: Partial<Record<GridFamily, FlowConfig>>};
export function familyConfigKey(family: GridFamily): string { return `${FAMILY_STORE_KEY}.${family}`; }

export function seedFamily(family: GridFamily, medium: FlowConfig): FlowConfig {
  if (family === 'medium') return normalizeFlowConfig(medium);
  const next = freshFlowConfig(family);
  for (const field of ['background', 'backgroundOpacity', 'foreground', 'padding', 'radius', 'gap'] as const) {
    Object.assign(next, {[field]: medium[field]});
  }
  const visible = Array.from({length: medium.rows}, (_, row) => flowRowItems(medium, row)).flat().map(item => item.cell);
  let index = 0;
  for (let row = 0; row < next.rows; row++) for (let column = 0; column < next.columns[row]; column++) {
    const cell = visible[index++];
    if (cell) next.cells[row][column] = {...cell, domain: String(column + 1)};
  }
  return next;
}

export function normalizeFamilyConfigs(input?: unknown, legacyMedium?: unknown): FamilyConfigs {
  const raw = input as Partial<StoredFamilyConfigs> | undefined;
  const sizes = raw?.version === 1 && raw.sizes && typeof raw.sizes === 'object' ? raw.sizes : undefined;
  const medium = normalizeFlowConfig(sizes?.medium ?? legacyMedium);
  const result = {version: 1, sizes: {}} as FamilyConfigs;
  for (const family of GRID_FAMILIES) {
    const existing = sizes?.[family];
    result.sizes[family] = existing ? normalizeFlowConfig(existing) : seedFamily(family, medium);
  }
  return result;
}

export function panelStateKey(family: GridFamily): string {
  return `LaunchGrid.panelState.v4.${family}`;
}

export function familyLabel(family: GridFamily): string { return FAMILY_DEFAULTS[family].label; }
