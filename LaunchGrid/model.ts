// Pure layout and editing rules, shared by the native widget and desktop preview.
export const MAX_ROWS = 4;
export const MAX_FLOW_ROWS = 8;
export const MAX_COLUMNS = 8;
export const STORE_KEY = 'LaunchGrid.config.v1';
export const GRID_FAMILIES = ['small', 'medium', 'large', 'extraLarge'] as const;
export type GridFamily = typeof GRID_FAMILIES[number];
export const FAMILY_DEFAULTS: Record<GridFamily, {rows: number; columns: number; label: string}> = {
  small: {rows: 2, columns: 2, label: '小尺寸'},
  medium: {rows: 3, columns: 6, label: '中尺寸'},
  large: {rows: 6, columns: 6, label: '大尺寸'},
  extraLarge: {rows: 8, columns: 6, label: '超大尺寸'},
};
export function gridFamily(value: unknown): GridFamily {
  if (value === 'extraLargePortrait') return 'extraLarge';
  return GRID_FAMILIES.includes(value as GridFamily) ? value as GridFamily : 'medium';
}

export type CanonicalActionKind = 'mountedShortcut' | 'universalLink' | 'awaitLaunch' | 'scheme' | 'shortcutName' | 'none';
// Legacy values remain readable for v1/v2 migration and compatibility helpers.
export type ActionKind = CanonicalActionKind | 'url' | 'shortcut' | 'directScheme';
export type Fit = 'fit' | 'fill';
export type Cell = {
  domain: string;
  image: string;
  title: string;
  showText: boolean;
  fit: Fit;
  action: ActionKind;
  target: string;
  shortcutIndex?: number;
};
export type Config = {
  version: 1;
  rows: number;
  columns: number[];
  gap: number;
  padding: number;
  radius: number;
  background: string;
  backgroundOpacity: number;
  foreground: string;
  cells: Cell[][];
};
export type Group = {column: number; span: number; cell: Cell};
export type Result<T> = {ok: true; value: T} | {ok: false; message: string};

// Short panel labels fit narrow native forms; accept old labels without changing stored actions.
export function actionFromLabel(value: string): ActionKind {
  if (value === '挂载快捷指令') return 'mountedShortcut';
  if (value === 'Univ Link') return 'universalLink';
  if (value === 'AwaitLaunch') return 'awaitLaunch';
  if (value === 'Urlscheme') return 'scheme';
  if (value === '快捷指令名称') return 'shortcutName';
  if (value === '协议直达·实验' || value === 'URL Scheme直达（实验）') return 'directScheme';
  if (value === '挂载指令' || value === '挂载快捷指令（桌面直达）') return 'mountedShortcut';
  if (value === '兼容链接' || value === 'URL Scheme或网页') return 'url';
  if (value === '按名称运行' || value === '快捷指令') return 'shortcut';
  return 'none';
}

export function canonicalAction(action: ActionKind, target: string): CanonicalActionKind {
  if (action === 'url') return /^https?:/i.test(target.trim()) ? 'universalLink' : 'scheme';
  if (action === 'directScheme') return 'scheme';
  if (action === 'shortcut') return 'shortcutName';
  return action;
}

export function actionLabel(action: ActionKind, target = ''): string {
  return ({mountedShortcut: '挂载快捷指令', universalLink: 'Univ Link', awaitLaunch: 'AwaitLaunch',
    scheme: 'Urlscheme', shortcutName: '快捷指令名称', none: '无动作'})[canonicalAction(action, target)];
}

export function isBundleId(value: string): boolean {
  return value.length <= 255 && /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value);
}

export type ActionSettings = {action: CanonicalActionKind; target: string; shortcutIndex?: number};
export function actionInput(cell: Pick<Cell, 'action' | 'target' | 'shortcutIndex'>): string {
  if (cell.action === 'mountedShortcut') return isShortcutIndex(cell.shortcutIndex) ? String(cell.shortcutIndex) : '';
  return cell.action === 'none' ? '' : cell.target;
}

export function parseActionInput(action: ActionKind, input: string): Result<ActionSettings> {
  const target = input.trim();
  const kind = canonicalAction(action, target);
  if (kind === 'none') return {ok: true, value: {action: kind, target: '', shortcutIndex: undefined}};
  if (kind === 'mountedShortcut') {
    const index = /^\d+$/.test(target) ? Number(target) : NaN;
    if (!isShortcutIndex(index)) return {ok: false, message: '输入参数请填从0开始的挂载序号，例如0、1、2。'};
    return {ok: true, value: {action: kind, target: '', shortcutIndex: index}};
  }
  if (kind === 'awaitLaunch') {
    if (!isBundleId(target)) return {ok: false, message: '输入参数请填Bundle ID，例如tv.danmaku.bilianime；不要填网址或App名称。'};
  } else {
    const valid = actionURL({action: kind, target});
    if (!valid.ok) return valid;
  }
  return {ok: true, value: {action: kind, target, shortcutIndex: undefined}};
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

export function integer(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}

export function placeholder(row: number, column: number): string {
  return `assets/slot-${row + 1}-${column + 1}.svg`;
}

export function freshConfig(capacity = MAX_ROWS): Config {
  return {
    version: 1, rows: 3, columns: Array.from({length: capacity}, () => 6), gap: 4, padding: 10,
    radius: 9, background: '#f1f0f5', backgroundOpacity: 0, foreground: '#22252f',
    cells: Array.from({length: capacity}, (_, row) =>
      Array.from({length: MAX_COLUMNS}, (_, column): Cell => ({
        domain: String(column + 1), image: placeholder(row, column),
        title: `按钮 ${row + 1}-${column + 1}`, showText: false,
        fit: 'fit', action: 'none', target: '',
      }))),
  };
}

export function isLocalImage(path: string): boolean {
  // Files are inside the widget, never an arbitrary computer path or remote URL.
  return !!path && path === path.trim() && !/[:\\\u0000-\u001f?#]/.test(path)
    && !path.startsWith('/') && !path.split('/').some(part => !part || part === '.' || part === '..')
    && /\.(png|jpe?g|webp|gif|heic|svg)$/i.test(path);
}

export function normalizeConfig(input?: Config, capacity = MAX_ROWS): Config {
  const result = freshConfig(capacity);
  if (!input || input.version !== 1) return result;
  result.rows = integer(input.rows, 1, capacity);
  result.columns = result.columns.map((_, row) => integer(input.columns?.[row] ?? 6, 1, MAX_COLUMNS));
  result.gap = integer(input.gap, 0, 12);
  result.padding = integer(input.padding, 0, 20);
  result.radius = integer(input.radius, 0, 20);
  result.background = typeof input.background === 'string' ? input.background : result.background;
  // Existing v1 configurations keep their previous opaque background until explicitly changed.
  result.backgroundOpacity = typeof input.backgroundOpacity === 'number'
    ? clamp(input.backgroundOpacity, 0, 1) : 1;
  result.foreground = typeof input.foreground === 'string' ? input.foreground : result.foreground;
  result.cells = result.cells.map((row, r) => row.map((fallback, c) => {
    const cell = input.cells?.[r]?.[c];
    if (!cell) return fallback;
    return {
      domain: String(cell.domain ?? fallback.domain).trim(),
      image: isLocalImage(cell.image ?? '') ? cell.image : fallback.image,
      title: typeof cell.title === 'string' ? cell.title.slice(0, 100) : fallback.title,
      showText: cell.showText === true,
      fit: cell.fit === 'fill' ? 'fill' : 'fit',
      action: ['url', 'shortcut', 'mountedShortcut', 'directScheme', 'universalLink', 'awaitLaunch', 'scheme', 'shortcutName'].includes(cell.action) ? cell.action : 'none',
      target: typeof cell.target === 'string' ? cell.target.trim() : '',
      shortcutIndex: isShortcutIndex(cell.shortcutIndex) ? cell.shortcutIndex : undefined,
    };
  }));
  return result;
}

export function groupsForRow(config: Config, row: number): Group[] {
  const groups: Group[] = [];
  if (row < 0 || row >= config.rows) return groups;
  for (let column = 0; column < config.columns[row]; column++) {
    const cell = config.cells[row][column];
    const last = groups[groups.length - 1];
    // Blank domains always stand alone. Equality is scoped to adjacent cells in this row.
    if (last && cell.domain !== '' && last.cell.domain === cell.domain) last.span++;
    else groups.push({column, span: 1, cell});
  }
  return groups;
}

export function selectedOwner(config: Config, row: number, column: number): Result<Group> {
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || row >= config.rows
      || column < 0 || column >= config.columns[row]) {
    return {ok: false, message: '该位置当前未显示，请先增加行数或本行格数并保存布局。'};
  }
  const group = groupsForRow(config, row).find(item => column >= item.column && column < item.column + item.span);
  return group ? {ok: true, value: group} : {ok: false, message: '找不到该按钮。'};
}

export function actionURL(cell: Pick<Cell, 'action' | 'target'>): Result<string> {
  const target = cell.target.trim();
  if (cell.action === 'none') return {ok: true, value: ''};
  // Mounted shortcuts need no URL on the Home Screen. Their name is an optional app-only fallback.
  if (cell.action === 'mountedShortcut' && !target) return {ok: true, value: ''};
  if (!target) return {ok: false, message: (cell.action === 'shortcut' || cell.action === 'shortcutName') ? '请填写快捷指令名称。' : '请填写完整 URL，例如 nutstore://。'};
  if (/[\u0000-\u001f\u007f]/.test(target)) return {ok: false, message: '跳转目标中不能包含换行或控制字符。'};
  if (cell.action === 'awaitLaunch') {
    return isBundleId(target) ? {ok: true, value: ''} : {ok: false, message: '请填写有效的Bundle ID。'};
  }
  if (cell.action === 'shortcut' || cell.action === 'shortcutName' || cell.action === 'mountedShortcut') {
    return {ok: true, value: `shortcuts://run-shortcut?name=${encodeURIComponent(target)}`};
  }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(target) || /\s/.test(target)) {
    return {ok: false, message: '请填写带协议的完整 URL；URL 中的空格请先编码。'};
  }
  if (/^(javascript|data|file|vbscript):/i.test(target)) return {ok: false, message: '这里支持应用 URL Scheme 和网页链接。'};
  if (cell.action === 'universalLink' && !/^https?:\/\/[^/?#\s]+(?:[/?#][^\s]*)?$/i.test(target)) {
    return {ok: false, message: 'Univ Link请输入完整的HTTP或HTTPS网址。'};
  }
  if (cell.action === 'scheme' && /^https?:/i.test(target)) {
    return {ok: false, message: 'Urlscheme请输入应用协议，例如nutstore://；网页地址请选择Univ Link。'};
  }
  if (cell.action === 'directScheme' && /^https?:/i.test(target)) {
    return {ok: false, message: 'URL Scheme直达用于 bilibili://、nutstore:// 等应用协议；此模式不接受网页地址。'};
  }
  if (/^https?:/i.test(target) && !/^https?:\/\/[^/?#]+/i.test(target)) {
    return {ok: false, message: '网页链接应类似 https://example.com。'};
  }
  return {ok: true, value: target};
}

export function isShortcutIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function editCell(config: Config, row: number, column: number, patch: Partial<Omit<Cell, 'domain'>>): Result<Config> {
  const owner = selectedOwner(config, row, column);
  if (!owner.ok) return owner;
  if (owner.value.column !== column) {
    return {ok: false, message: `保存已阻止：第 ${row + 1} 行第 ${column + 1} 格已合并，由第 ${owner.value.column + 1} 格控制。请编辑主按钮，或修改域后保存布局以拆分。`};
  }
  const next = normalizeConfig(config);
  const candidate: Cell = {...next.cells[row][column], ...patch};
  if (!isLocalImage(candidate.image)) return {ok: false, message: '图片请填写组件内的相对路径，例如 assets/my-icon.png。'};
  if (candidate.action === 'mountedShortcut' && !isShortcutIndex(candidate.shortcutIndex)) {
    return {ok: false, message: '挂载快捷指令序号必须是从 0 开始的整数。请按手机小组件挂载组中的实际顺序填写。'};
  }
  const action = actionURL(candidate);
  if (!action.ok) return action;
  next.cells[row][column] = {...candidate, title: candidate.title.slice(0, 100), target: candidate.target.trim()};
  return {ok: true, value: next};
}

export function applyLayout(config: Config, layout: {
  rows: number; columns: number[]; domains: string[][];
  gap: number; padding: number; radius: number; background: string; backgroundOpacity?: number; foreground: string;
}): Config {
  const next = normalizeConfig(config);
  next.rows = integer(layout.rows, 1, MAX_ROWS);
  next.columns = next.columns.map((_, row) => integer(layout.columns[row] ?? 6, 1, MAX_COLUMNS));
  next.gap = integer(layout.gap, 0, 12);
  next.padding = integer(layout.padding, 0, 20);
  next.radius = integer(layout.radius, 0, 20);
  next.background = layout.background;
  if (layout.backgroundOpacity !== undefined) next.backgroundOpacity = clamp(layout.backgroundOpacity, 0, 1);
  next.foreground = layout.foreground;
  // Retain the covered cells' content so splitting or restoring a row never erases it.
  next.cells.forEach((row, r) => row.forEach((cell, c) => {
    cell.domain = String(layout.domains[r]?.[c] ?? c + 1).trim();
  }));
  return next;
}

export function geometry(config: Config, width: number, height: number): {
  padding: number; gap: number; rowHeight: number; innerWidth: number;
} {
  const padding = Math.min(config.padding, Math.max(0, (Math.min(width, height) - 20) / 2));
  const innerWidth = Math.max(1, width - 2 * padding);
  const innerHeight = Math.max(1, height - 2 * padding);
  const gap = Math.min(config.gap, innerWidth / (MAX_COLUMNS * 2), innerHeight / (Math.max(MAX_ROWS, config.rows) * 2));
  return {padding, gap, rowHeight: Math.max(1, (innerHeight - gap * (config.rows - 1)) / config.rows), innerWidth};
}

export function groupWidth(innerWidth: number, gap: number, columns: number, span: number): number {
  return Math.max(1, ((innerWidth - gap * (columns - 1)) / columns) * span + gap * (span - 1));
}

// v2 introduced Flow; v3 added canonical actions; v4 expands storage to 8x8.
// Keep the v1 helpers above so old configurations can be migrated without losing content.
export const FLOW_BACKUP_KEY = 'LaunchGrid.config.beforeFlow.v1';
export const ACTION_BACKUP_KEY = 'LaunchGrid.config.beforeActions.v2';
export type FlowCell = Omit<Cell, 'action'> & {
  action: CanonicalActionKind; multiple: number; showImage: boolean;
  buttonColor: string; buttonOpacity: number;
};
export type FlowRowSettings = {widthPercent: number; gap: number; alignment: 'leading' | 'center' | 'trailing'};
export type FlowConfig = Omit<Config, 'version' | 'cells'> & {
  version: 2 | 3 | 4;
  rowSettings: FlowRowSettings[];
  cells: FlowCell[][];
};
export type FlowGroup = {column: number; span: number; cell: FlowCell};

export function freshFlowConfig(family: GridFamily = 'medium'): FlowConfig {
  const old = freshConfig(MAX_FLOW_ROWS);
  const defaults = FAMILY_DEFAULTS[family];
  return {
    ...old, version: 4, rows: defaults.rows,
    columns: Array.from({length: MAX_FLOW_ROWS}, () => defaults.columns),
    rowSettings: Array.from({length: MAX_FLOW_ROWS}, () => ({widthPercent: 100, gap: 4, alignment: 'center'})),
    cells: old.cells.map(row => row.map(cell => ({...cell, action: canonicalAction(cell.action, cell.target), multiple: 1, showImage: true,
      buttonColor: '#ffffff', buttonOpacity: 1}))),
  };
}

export function normalizeFlowConfig(input?: unknown): FlowConfig {
  if (!input || typeof input !== 'object') return freshFlowConfig();
  const raw = input as FlowConfig | Config;
  if (raw.version !== 1 && raw.version !== 2 && raw.version !== 3 && raw.version !== 4) return freshFlowConfig();
  const legacy = normalizeConfig({...raw, version: 1} as Config, MAX_FLOW_ROWS);
  const result: FlowConfig = {
    ...legacy, version: 4,
    rowSettings: Array.from({length: MAX_FLOW_ROWS}, () => ({widthPercent: 100, gap: legacy.gap, alignment: 'center'})),
    cells: legacy.cells.map(row => row.map(cell => ({...cell, action: canonicalAction(cell.action, cell.target), multiple: 1, showImage: true,
      buttonColor: '#ffffff', buttonOpacity: 1}))),
  };
  if (raw.version === 1) {
    for (let row = 0; row < MAX_FLOW_ROWS; row++) {
      const groups = groupsForRow({...legacy, rows: MAX_FLOW_ROWS}, row);
      const owners = groups.map(group => group.column);
      const order = [...owners, ...Array.from({length: MAX_COLUMNS}, (_, c) => c).filter(c => !owners.includes(c))];
      result.columns[row] = groups.length;
      result.cells[row] = order.map(column => ({
        ...legacy.cells[row][column],
        action: canonicalAction(legacy.cells[row][column].action, legacy.cells[row][column].target),
        showImage: true,
        buttonColor: '#ffffff', buttonOpacity: 1,
        multiple: groups.find(group => group.column === column)?.span ?? 1,
      }));
    }
    return result;
  }
  result.rowSettings = result.rowSettings.map((fallback, row) => {
    const settings = raw.rowSettings?.[row];
    return {
      widthPercent: integer(settings?.widthPercent ?? 100, 10, 100),
      gap: integer(settings?.gap ?? fallback.gap, 0, 24),
      alignment: settings?.alignment === 'leading' || settings?.alignment === 'trailing' ? settings.alignment : 'center',
    };
  });
  result.cells.forEach((row, r) => row.forEach((cell, c) => {
    cell.multiple = integer(raw.cells?.[r]?.[c]?.multiple ?? 1, 1, 8);
    cell.showImage = raw.cells?.[r]?.[c]?.showImage !== false;
    const color = raw.cells?.[r]?.[c]?.buttonColor;
    cell.buttonColor = typeof color === 'string' && color.trim() && color.length <= 128 ? color : '#ffffff';
    const opacity = raw.cells?.[r]?.[c]?.buttonOpacity;
    cell.buttonOpacity = typeof opacity === 'number' ? clamp(opacity, 0, 1) : 1;
  }));
  return result;
}

export function flowRowItems(config: FlowConfig, row: number): FlowGroup[] {
  if (row < 0 || row >= config.rows) return [];
  return config.cells[row].slice(0, config.columns[row]).map((cell, column) => ({column, span: cell.multiple, cell}));
}

export function selectFlowButton(config: FlowConfig, row: number, column: number): Result<FlowGroup> {
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || row >= config.rows
      || column < 0 || column >= config.columns[row]) {
    return {ok: false, message: '该按钮当前未显示。请先保存总行数和本行按钮数量。'};
  }
  const cell = config.cells[row][column];
  return {ok: true, value: {column, span: cell.multiple, cell}};
}

export function editFlowCell(config: FlowConfig, row: number, column: number, patch: Partial<Omit<FlowCell, 'domain'>>): Result<FlowConfig> {
  const selection = selectFlowButton(config, row, column);
  if (!selection.ok) return selection;
  const next = normalizeFlowConfig(config);
  const candidate = {...next.cells[row][column], ...patch};
  if (!isLocalImage(candidate.image)) return {ok: false, message: '图片请填写组件内的相对路径，例如 assets/my-icon.png。'};
  if (!Number.isInteger(candidate.multiple) || candidate.multiple < 1 || candidate.multiple > 8) {
    return {ok: false, message: '宽度倍数请选择1～8。'};
  }
  if (typeof candidate.buttonColor !== 'string' || !candidate.buttonColor.trim() || candidate.buttonColor.length > 128 || !Number.isFinite(candidate.buttonOpacity)
      || candidate.buttonOpacity < 0 || candidate.buttonOpacity > 1) {
    return {ok: false, message: '按钮颜色或透明度无效。'};
  }
  if (candidate.action === 'mountedShortcut' && !isShortcutIndex(candidate.shortcutIndex)) {
    return {ok: false, message: '挂载快捷指令序号必须是从0开始的整数。'};
  }
  const action = actionURL(candidate);
  if (!action.ok) return action;
  next.cells[row][column] = {...candidate, title: candidate.title.slice(0, 100), target: candidate.target.trim()};
  return {ok: true, value: next};
}

export function editFlowRow(config: FlowConfig, row: number, settings: Omit<FlowRowSettings, 'widthPercent'> & {count: number; widthPercent?: number}): Result<FlowConfig> {
  if (!Number.isInteger(row) || row < 0 || row >= config.rows) {
    return {ok: false, message: '该行当前未显示。请先增加总行数并保存布局。'};
  }
  const next = normalizeFlowConfig(config);
  next.columns[row] = integer(settings.count, 1, MAX_COLUMNS);
  next.rowSettings[row] = {
    widthPercent: integer(settings.widthPercent ?? next.rowSettings[row].widthPercent, 10, 100),
    gap: integer(settings.gap, 0, 24),
    alignment: settings.alignment === 'leading' || settings.alignment === 'trailing' ? settings.alignment : 'center',
  };
  return {ok: true, value: next};
}

export function applyFlowLayout(config: FlowConfig, layout: {
  rows: number; gap: number; padding: number; radius: number; background: string; backgroundOpacity: number; foreground: string;
}): FlowConfig {
  const next = normalizeFlowConfig(config);
  next.rows = integer(layout.rows, 1, MAX_FLOW_ROWS);
  next.gap = integer(layout.gap, 0, 12);
  next.padding = integer(layout.padding, 0, 20);
  next.radius = integer(layout.radius, 0, 20);
  next.background = layout.background;
  next.backgroundOpacity = clamp(layout.backgroundOpacity, 0, 1);
  next.foreground = layout.foreground;
  return next;
}

export function flowGeometry(config: FlowConfig, width: number, height: number): ReturnType<typeof geometry> {
  return geometry({...config, version: 1} as Config, width, height);
}

export function flowRowGeometry(config: FlowConfig, row: number, innerWidth: number, rowHeight: number): {
  widths: number[]; height: number; gap: number; totalWidth: number;
} {
  const items = flowRowItems(config, row);
  if (items.length === 0) return {widths: [], height: 0, gap: 0, totalWidth: 0};
  const settings = config.rowSettings[row];
  const width = Math.max(items.length + 1, Math.floor(innerWidth * clamp(settings.widthPercent ?? 100, 10, 100) / 100));
  // Leave 1pt spare and use whole-point frames to avoid rounding causing Flow to wrap the last item.
  const gap = Math.min(settings.gap, items.length > 1 ? Math.max(0, Math.floor((width - items.length - 1) / (items.length - 1))) : 0);
  const available = width - 1 - gap * (items.length - 1);
  const units = items.reduce((sum, item) => sum + item.cell.multiple, 0);
  // Allocate the available space by weight, keeping every frame at least one point wide.
  // Largest remainders use the whole budget without accumulating per-item rounding gaps.
  const ideal = items.map(item => Math.max(1, available * item.cell.multiple / units));
  const widths = ideal.map(value => Math.floor(value));
  const order = ideal.map((value, index) => ({index, fraction: value - widths[index]}))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  let remaining = available - widths.reduce((sum, value) => sum + value, 0);
  for (const item of order) { if (remaining <= 0) break; widths[item.index]++; remaining--; }
  // Only relevant for extremely narrow containers: keep all frames inside the budget.
  for (let i = widths.length - 1; remaining < 0 && i >= 0; i--) {
    const reduction = Math.min(widths[i] - 1, -remaining);
    widths[i] -= reduction; remaining += reduction;
  }
  return {
    widths, height: Math.max(1, Math.floor(rowHeight)), gap,
    totalWidth: widths.reduce((sum, value) => sum + value, 0) + gap * (items.length - 1),
  };
}
