import {MAX_ROWS, MAX_FLOW_ROWS, MAX_COLUMNS, actionInput, isLocalImage, normalizeFlowConfig, parseActionInput} from './model';
import type {ActionKind, FlowConfig, GridFamily, Result} from './model';

export const CONFIG_FORMAT = 'LaunchGrid.config';
export const CONFIG_FORMAT_VERSION = 1;
// One size's complete 64-button configuration is normally well below this limit.
export const MAX_CONFIG_TEXT_LENGTH = 262144;

type ObjectValue = Record<string, unknown>;
function object(value: unknown): value is ObjectValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function numberIn(value: unknown, min: number, max: number, integer = true): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    && (!integer || Number.isInteger(value));
}
function text(value: unknown, max = MAX_CONFIG_TEXT_LENGTH): value is string {
  return typeof value === 'string' && value.length <= max;
}

// Validate before normalization: malformed or partial imports must never become defaults.
function validateConfig(value: unknown): Result<FlowConfig> {
  const fail = (detail: string): Result<FlowConfig> => ({ok: false, message: `导入失败：${detail}；当前配置未替换。`});
  if (!object(value)) return fail('配置必须是JSON对象');
  const version = value.version;
  if (version !== 1 && version !== 2 && version !== 3 && version !== 4) return fail('不支持此配置版本');
  const capacity = version === 4 ? MAX_FLOW_ROWS : MAX_ROWS;
  if (!numberIn(value.rows, 1, capacity) || !Array.isArray(value.columns)
      || value.columns.length !== capacity || !value.columns.every(count => numberIn(count, 1, MAX_COLUMNS))) {
    return fail('行数或按钮数量不完整/超出范围');
  }
  for (const [key, max] of [['gap', 12], ['padding', 20], ['radius', 20]] as const) {
    if (!numberIn(value[key], 0, max)) return fail(`布局参数${key}无效`);
  }
  if (!text(value.background, 128) || !value.background.trim() || !text(value.foreground, 128) || !value.foreground.trim()) {
    return fail('缺少背景色或文字颜色');
  }
  if ((value.backgroundOpacity !== undefined || version >= 3) && !numberIn(value.backgroundOpacity, 0, 1, false)) {
    return fail('背景不透明度无效');
  }
  if (version !== 1) {
    if (!Array.isArray(value.rowSettings) || value.rowSettings.length !== capacity) return fail('行设置不完整');
    for (const settings of value.rowSettings) {
      if (!object(settings) || !numberIn(settings.gap, 0, 24)
          || typeof settings.alignment !== 'string' || !['leading', 'center', 'trailing'].includes(settings.alignment)
          || ((settings.widthPercent !== undefined || version >= 3) && !numberIn(settings.widthPercent, 10, 100))) {
        return fail('行宽、间距或对齐无效');
      }
    }
  }
  if (!Array.isArray(value.cells) || value.cells.length !== capacity) return fail('按钮数据不完整');
  const actions = ['mountedShortcut', 'universalLink', 'awaitLaunch', 'scheme', 'shortcutName', 'none'];
  if (version < 3) actions.push('url', 'shortcut', 'directScheme');
  for (let row = 0; row < capacity; row++) {
    const cells: unknown = value.cells[row];
    if (!Array.isArray(cells) || cells.length !== MAX_COLUMNS) return fail(`第${row + 1}行按钮数据不完整`);
    for (let column = 0; column < MAX_COLUMNS; column++) {
      const cell: unknown = cells[column];
      const position = `第${row + 1}行第${column + 1}个按钮`;
      if (!object(cell) || !text(cell.domain, 100) || !text(cell.image) || !isLocalImage(cell.image)
          || !text(cell.title, 100) || typeof cell.showText !== 'boolean'
          || (cell.fit !== 'fit' && cell.fit !== 'fill') || !text(cell.target)
          || typeof cell.action !== 'string' || !actions.includes(cell.action)) {
        return fail(`${position}的图片路径、文字或动作数据无效`);
      }
      if (version !== 1 && (!numberIn(cell.multiple, 1, 8)
          || ((cell.showImage !== undefined || version >= 3) && typeof cell.showImage !== 'boolean'))) {
        return fail(`${position}的宽度倍数或图片开关无效`);
      }
      if ((cell.buttonColor !== undefined && (!text(cell.buttonColor, 128) || !cell.buttonColor.trim()))
          || (cell.buttonOpacity !== undefined && !numberIn(cell.buttonOpacity, 0, 1, false))) {
        return fail(`${position}的按钮颜色或透明度无效`);
      }
      if (cell.shortcutIndex !== undefined && !numberIn(cell.shortcutIndex, 0, Number.MAX_SAFE_INTEGER)) {
        return fail(`${position}的挂载序号无效`);
      }
      const action = cell.action as ActionKind;
      const input = actionInput({action, target: cell.target, shortcutIndex: cell.shortcutIndex as number | undefined});
      const parsed = parseActionInput(action, input);
      if (!parsed.ok) return fail(`${position}：${parsed.message}`);
    }
  }
  return {ok: true, value: normalizeFlowConfig(value)};
}

export function exportConfigJSON(config: FlowConfig, family?: GridFamily): Result<string> {
  const normalized = normalizeFlowConfig(config);
  const checked = validateConfig(normalized);
  if (!checked.ok) return {ok: false, message: checked.message.replace('导入失败：', '导出失败：').replace('；当前配置未替换。', '；请先修正配置。')};
  const json = JSON.stringify({format: CONFIG_FORMAT, formatVersion: CONFIG_FORMAT_VERSION, ...(family ? {family} : {}), config: checked.value}, null, 2);
  if (json.length > MAX_CONFIG_TEXT_LENGTH) return {ok: false, message: '导出失败：配置文本超过256K字符，请缩短过长参数。'};
  return {ok: true, value: json};
}

export function importConfigJSON(input: string): Result<FlowConfig> {
  if (input.length > MAX_CONFIG_TEXT_LENGTH) return {ok: false, message: '导入失败：配置文本超过256K字符；当前配置未替换。'};
  let value: unknown;
  try { value = JSON.parse(input.replace(/^\uFEFF/, '').trim()); }
  catch { return {ok: false, message: '导入失败：请粘贴完整的JSON配置；当前配置未替换。'}; }
  if (object(value) && ('format' in value || 'formatVersion' in value || 'config' in value)) {
    if (value.format !== CONFIG_FORMAT || value.formatVersion !== CONFIG_FORMAT_VERSION) {
      return {ok: false, message: '导入失败：不是支持的LaunchGrid配置文件；当前配置未替换。'};
    }
    value = value.config;
  }
  return validateConfig(value);
}
