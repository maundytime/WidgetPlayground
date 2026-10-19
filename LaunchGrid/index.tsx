import {Button, Flow, HStack, Image, Link, Scroll, Svg, Text, VStack, ZStack} from 'await';
import {
  STORE_KEY, FLOW_BACKUP_KEY, ACTION_BACKUP_KEY, actionFromLabel, actionLabel, actionInput, parseActionInput,
  actionURL, isLocalImage, isBundleId, editFlowCell, placeholder, gridFamily, GRID_FAMILIES,
  freshFlowConfig,
  flowGeometry as geometry, flowRowItems as groupsForRow, normalizeFlowConfig as normalizeConfig,
  selectFlowButton as selectedOwner, flowRowGeometry,
} from './model';
import type {Config as LegacyConfig, FlowCell as Cell, FlowConfig as Config, FlowGroup as Group, GridFamily} from './model';
import {exportConfigJSON, importConfigJSON} from './transfer';
import {ACTIVE_FAMILY_KEY, normalizeFamilyConfigs, panelStateKey, familyConfigKey, familyLabel} from './families';
import type {FamilyConfigs, StoredFamilyConfigs} from './families';

type EntryData = {config: Config; configFamily: GridFamily};
const MESSAGE_KEY = 'LaunchGrid.message.v1';
const EXAMPLE_KEY = 'LaunchGrid.textExample.v1';
const EXAMPLE_TEXT_KEY = 'LaunchGrid.textExampleText.v1';
const COLOR_EDITOR_KEY = 'LaunchGrid.textColorEditor.v1';
const COLOR_DRAFT_KEY = 'LaunchGrid.textColorDraft.v1';
const TRANSFER_MESSAGE_KEY = 'LaunchGrid.transferMessage.v1';

// @panel {title_zh:'----配置说明----'}
const showHelp = false;

// Colors and sliders sync changed values when the App preview refreshes.
// @panel {type:'color',title_zh:'背景颜色'}
const background = '#f1f0f5';
// @panel {type:'slider',min:0,max:1,step:0.05,title_zh:'背景不透明度'}
const backgroundOpacity = 0;

// Layout
// @panel {type:'menu',items:[1,2,3,4,5,6,7,8],title_zh:'行数'}
const rowCount = 3;
// @panel {type:'slider',min:0,max:12,step:1,title_zh:'行间距'}
const gap = 4;
// @panel {type:'slider',min:0,max:20,step:1,title_zh:'外边距'}
const padding = 10;
// @panel {type:'slider',min:0,max:20,step:1,title_zh:'按钮圆角'}
const radius = 9;

// Row editing
// @panel {type:'menu',items:[1,2,3,4,5,6,7,8],title_zh:'【编辑行】'}
const editRow = 1;
// @panel {type:'menu',items:[1,2,3,4,5,6,7,8],title_zh:'本行数量'}
const draftRowCount = 6;
// @panel {type:'slider',min:10,max:100,step:5,title_zh:'本行宽度%'}
const draftRowWidthPercent = 100;
// @panel {type:'slider',min:0,max:24,step:1,title_zh:'本行间距'}
const draftRowGap = 4;
// @panel {type:'menu',items:['靠左','居中','靠右'],title_zh:'本行对齐'}
const draftRowAlignment: string = '居中';

// Button editing
// @panel {type:'menu',items:[1,2,3,4,5,6,7,8],title_zh:'【编辑按钮】'}
const editColumn = 1;
// @panel {title_zh:'----查看信息----'}
const showEditorInfo = false;
// @panel {type:'menu',items:[1,2,3,4,5,6,7,8],title_zh:'宽度倍数'}
const draftMultiple = 1;
// Native input changes autosave only their changed fields.
// @panel {title_zh:'按钮显示图片'}
const draftShowImage = true;
// @panel {type:'color',title_zh:'按钮颜色'}
const draftButtonColor = '#ffffff';
// @panel {type:'slider',min:0,max:100,step:5,title_zh:'按钮透明度'}
const draftButtonOpacity = 100;
// @panel {title_zh:'图片路径'}
const draftImage = '';
// @panel {type:'menu',items:['完整显示','填满裁剪'],title_zh:'图片缩放'}
const draftFit: string = '完整显示';
// @panel {title_zh:'----文字调整----'}
const showTextEditor = false;
// @panel {title_zh:'文字内容'}
const draftTitle = '';
// @panel {type:'menu',items:['挂载快捷指令','Univ Link','AwaitLaunch','Urlscheme','快捷指令名称','无动作'],title_zh:'点击行为'}
const draftAction: string = '无动作';
// @panel {title_zh:'输入参数'}
const draftParameter = '';
// @panel {title_zh:'保存点击行为'}
function saveAction(): void {
  if (AwaitEnv.host === 'app') syncPanelChanges();
  const config = load(); const row = currentRow(config) - 1; const column = currentColumn(config) - 1;
  const parsed = parseActionInput(actionFromLabel(draftAction), draftParameter);
  if (!parsed.ok) { message(parsed.message); return; }
  const result = editFlowCell(config, row, column, parsed.value);
  if (!result.ok) { message(result.message); return; }
  save(result.value, `已保存${familyLabel(activeFamily())}第${row + 1}行第${column + 1}个按钮的点击行为。`);
}

// Configuration transfer; no images or native panel/action drafts are serialized.
// @panel {title_zh:'----配置导入导出----'}
const showConfigTransfer = false;
// @panel {title_zh:'导入JSON'}
const importJSON = '';
// @panel {title_zh:'复制配置JSON'}
function copyConfig(): void {
  if (AwaitEnv.host !== 'app') return;
  syncPanelChanges();
  const result = exportConfigJSON(load(), activeFamily());
  if (!result.ok) { transferMessage(result.message); return; }
  try {
    AwaitClipboard.set(result.value);
    transferMessage(`${familyLabel(activeFamily())}配置JSON已复制。只含当前尺寸，不包含图片文件或未保存的动作草稿。`);
  } catch {
    transferMessage('复制失败，请重试；当前配置未改变。');
  }
}
// @panel {title_zh:'导入并替换'}
function replaceConfig(): void {
  if (AwaitEnv.host !== 'app') return;
  const result = importConfigJSON(importJSON);
  if (!result.ok) { transferMessage(result.message); return; }
  // Baseline the unchanged native fields before the replacement so the next preview
  // does not apply stale input values to the newly imported configuration.
  AwaitStore.set(panelStateKey(activeFamily()), panelValues());
  // Intentionally bypass save(): the user requested replacement without a backup.
  writeFamily(result.value);
  transferMessage(`导入成功，${familyLabel(activeFamily())}原配置已整体替换，未创建备份。其他尺寸不变，图片仍使用组件中的同路径文件。`);
}
// @panel {title_zh:'回到默认值'}
function resetDefaults(): void {
  if (AwaitEnv.host !== 'app') return;
  const family = activeFamily();
  // Persist real defaults rather than deleting the key, which would reseed from medium.
  AwaitStore.set(panelStateKey(family), panelValues());
  writeFamily(freshFlowConfig(family));
  AwaitStore.set(EXAMPLE_KEY, false);
  AwaitStore.set(EXAMPLE_TEXT_KEY, '示例文字 Aa 123');
  AwaitStore.set(COLOR_EDITOR_KEY, false);
  AwaitStore.set(COLOR_DRAFT_KEY, '');
  transferMessage(`${familyLabel(family)}已回到默认值：占位图、隐藏文字、无动作及透明底色。其他尺寸和图片文件保留；原生导入JSON输入框请手动清空。`);
}
function transferMessage(value: string): void {
  AwaitStore.set(TRANSFER_MESSAGE_KEY, value);
  message(value);
}

function launchApp(bundleId: string): void {
  if (!isBundleId(bundleId)) { message('Bundle ID无效，未执行启动。'); return; }
  AwaitLaunch.start(bundleId);
}

function toggleTextVisibility(): void {
  if (AwaitEnv.host === 'app') syncPanelChanges();
  const config = load(); const row = currentRow(config) - 1; const column = currentColumn(config) - 1;
  config.cells[row][column].showText = !config.cells[row][column].showText;
  save(config, '文字显示已直接更新。');
}
function setTextColor(color: string): void {
  if (AwaitEnv.host === 'app') syncPanelChanges();
  if (!/^#[0-9a-f]{6}$/i.test(color)) return;
  save({...load(), foreground: color}, '共用文字颜色已直接更新。');
}
function toggleTextExample(): void {
  AwaitStore.set(EXAMPLE_KEY, !(AwaitStore.get<boolean>(EXAMPLE_KEY) ?? false));
}

function setTextExample(text: string): void {
  AwaitStore.set(EXAMPLE_TEXT_KEY, text.slice(0, 100));
  AwaitStore.set(EXAMPLE_KEY, true);
}
function toggleColorEditor(): void {
  const open = !(AwaitStore.get<boolean>(COLOR_EDITOR_KEY) ?? false);
  AwaitStore.set(COLOR_EDITOR_KEY, open);
  if (open) {
    const color = load().foreground;
    AwaitStore.set(COLOR_DRAFT_KEY, /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1).toUpperCase() : '22252F');
  }
}
function colorKey(key: string): void {
  let draft = AwaitStore.get<string>(COLOR_DRAFT_KEY) ?? '';
  if (key === 'clear') draft = '';
  else if (key === 'backspace') draft = draft.slice(0, -1);
  else if (/^[0-9A-F]$/.test(key)) draft = (draft.length >= 6 ? '' : draft) + key;
  else return;
  AwaitStore.set(COLOR_DRAFT_KEY, draft);
  if (/^[0-9A-F]{6}$/.test(draft)) setTextColor('#' + draft);
}

function activeFamily(): GridFamily { return gridFamily(AwaitStore.get(ACTIVE_FAMILY_KEY)); }
function allConfigs(): FamilyConfigs {
  const sizes: StoredFamilyConfigs['sizes'] = {};
  for (const family of GRID_FAMILIES) {
    const saved = AwaitStore.get<Config>(familyConfigKey(family));
    if (saved) sizes[family] = saved;
  }
  return normalizeFamilyConfigs({version: 1, sizes}, AwaitStore.get(STORE_KEY));
}
function load(family: GridFamily = activeFamily()): Config { return allConfigs().sizes[family]; }
function ensureFamily(family: GridFamily): void {
  if (AwaitStore.get(familyConfigKey(family))) return;
  if (family !== 'medium') ensureFamily('medium');
  // Persist only the size being used: an unseen size must seed from the medium
  // configuration as it exists on that size's own first use, not an earlier snapshot.
  AwaitStore.set(familyConfigKey(family), allConfigs().sizes[family]);
}
function useFamily(value: unknown): GridFamily {
  const family = gridFamily(value);
  ensureFamily(family);
  if (AwaitStore.get(ACTIVE_FAMILY_KEY) !== family) {
    AwaitStore.set(ACTIVE_FAMILY_KEY, family);
    // Literal native fields do not refill on size switches: baseline rather than copy them.
    AwaitStore.set(panelStateKey(family), panelValues());
  }
  return family;
}
function writeFamily(config: Config): void {
  const family = activeFamily();
  AwaitStore.set(familyConfigKey(family), normalizeConfig(config));
}
function message(value: string): void { AwaitStore.set(MESSAGE_KEY, value); print(value); }
function save(config: Config, note: string): void {
  const old = AwaitStore.get<LegacyConfig | Config>(STORE_KEY);
  if (old?.version === 1 && !AwaitStore.get(FLOW_BACKUP_KEY)) AwaitStore.set(FLOW_BACKUP_KEY, old);
  if (old?.version === 2 && !AwaitStore.get(ACTION_BACKUP_KEY)) AwaitStore.set(ACTION_BACKUP_KEY, old);
  writeFamily(config);
  message(note);
}
// Native menus keep their literal selection. Clamp only the effective editing position
// when a selected row or button is hidden; changing selection never changes its content.
function currentRow(config: Config = load()): number {
  return Math.max(1, Math.min(config.rows, Math.round(editRow)));
}
function currentColumn(config: Config = load()): number {
  return Math.max(1, Math.min(config.columns[currentRow(config) - 1], Math.round(editColumn)));
}
function panelValues() {
  return {
    background, backgroundOpacity, gap, padding, radius, rowCount, editRow, editColumn,
    count: draftRowCount, multiple: draftMultiple,
    rowGap: draftRowGap, widthPercent: draftRowWidthPercent, alignment: draftRowAlignment,
    showImage: draftShowImage, image: draftImage, fit: draftFit, title: draftTitle,
    buttonColor: draftButtonColor, buttonOpacity: draftButtonOpacity,
  };
}
// @panel literal edits have no documented onChange callback. Reconcile only changed fields
// during App refresh. The first observation establishes a baseline and preserves saved data.
function syncPanelChanges(): void {
  const state = panelValues();
  const stateKey = panelStateKey(activeFamily());
  const previous = AwaitStore.get<Partial<typeof state>>(stateKey);
  if (previous && Object.keys(state).every(key => state[key as keyof typeof state] === previous[key as keyof typeof state])) return;
  if (previous) {
    // New fields establish their own baseline on upgrade. Never replace saved values
    // just because this source revision introduces a menu with a default literal.
    const changed = (key: keyof typeof state): boolean => previous[key] !== undefined && state[key] !== previous[key];
    let config = load(); let dirty = false;
    if (changed('background')) { config.background = state.background; dirty = true; }
    for (const field of ['backgroundOpacity', 'gap', 'padding', 'radius'] as const) {
      if (changed(field)) { config[field] = state[field]; dirty = true; }
    }
    if (changed('rowCount')) { config.rows = state.rowCount; dirty = true; }
    config = normalizeConfig(config);
    const row = currentRow(config) - 1;
    if (changed('count')) { config.columns[row] = state.count; dirty = true; }
    config = normalizeConfig(config);
    const column = currentColumn(config) - 1;
    if (changed('widthPercent')) { config.rowSettings[row].widthPercent = state.widthPercent; dirty = true; }
    if (changed('rowGap')) { config.rowSettings[row].gap = state.rowGap; dirty = true; }
    if (changed('alignment')) {
      config.rowSettings[row].alignment = state.alignment === '靠左' ? 'leading' : state.alignment === '靠右' ? 'trailing' : 'center';
      dirty = true;
    }
    if (changed('multiple')) { config.cells[row][column].multiple = state.multiple; dirty = true; }
    const cell = config.cells[row][column];
    if (changed('showImage')) { cell.showImage = state.showImage; dirty = true; }
    if (changed('buttonColor')) { cell.buttonColor = state.buttonColor; dirty = true; }
    if (changed('buttonOpacity')) { cell.buttonOpacity = state.buttonOpacity / 100; dirty = true; }
    if (changed('title')) { cell.title = state.title; dirty = true; }
    if (changed('fit')) { cell.fit = state.fit === '填满裁剪' ? 'fill' : 'fit'; dirty = true; }
    if (changed('image')) {
      const path = state.image.trim();
      if (path && isLocalImage(path) && AwaitFile.fileSize(path)) { cell.image = path; dirty = true; }
      else if (path) message('图片未找到或路径无效，保留原图。');
    }
    if (dirty) save(normalizeConfig(config), '配置已直接更新。');
  }
  AwaitStore.set(stateKey, state);
}
function widgetTimeline(context: TimelineContext): Timeline<EntryData> {
  const family = gridFamily(context.family);
  ensureFamily(family);
  if (AwaitEnv.host === 'app') { useFamily(family); syncPanelChanges(); }
  return {entries: [{date: new Date(), config: load(family), configFamily: family}], update: 'never'};
}

function Tile({group, width, height, config, row, interactive = true}: {
  group: Group; width: number; height: number; config: Config; row: number; interactive?: boolean;
}): NativeView {
  const {cell} = group;
  const withText = cell.showText && cell.title.trim().length > 0;
  const labelHeight = withText ? (cell.showImage ? Math.min(15, height * 0.3) : height) : 0;
  const imageHeight = cell.showImage ? Math.max(1, height - labelHeight) : 0;
  const imagePath = AwaitFile.fileSize(cell.image) ? cell.image : placeholder(row, group.column);
  const visual = (
    <ZStack frame={{width, height}} cornerRadius={config.radius} clipped>
      <VStack spacing={0} frame={{width, height}} background={cell.showImage ? '#ffffff' : cell.buttonColor} opacity={cell.buttonOpacity}>
      {cell.showImage ? /\.svg$/i.test(imagePath)
        ? <Svg url={imagePath} aspectRatio={cell.fit} frame={{width, height: imageHeight}} clipped/>
        : <Image url={imagePath} resizable aspectRatio={cell.fit} frame={{width, height: imageHeight}}
            maxPixel={256} style='original' clipped/> : undefined}
        {withText ? <VStack frame={{width, height: labelHeight}}/> : undefined}
      </VStack>
      {withText ? <VStack spacing={0} frame={{width, height}}>
        {cell.showImage ? <VStack frame={{width, height: imageHeight}}/> : undefined}
        <Text value={cell.title} fontSize={cell.showImage ? 11 : Math.min(18, height * 0.45)} textAlignment='center' fontWeight={500} foreground={config.foreground}
          lineLimit={1} minimumScaleFactor={0.6} frame={{width: Math.max(1, width - 4), height: labelHeight}}/>
      </VStack> : undefined}
    </ZStack>
  );
  if (!interactive) return visual;
  const parsed = parseActionInput(cell.action, actionInput(cell));
  if (!parsed.ok || parsed.value.action === 'none') return visual;
  const action = parsed.value;
  if (action.action === 'mountedShortcut') {
    return <Button shortcut={action.shortcutIndex} buttonStyle='borderless' frame={{width, height}}>{visual}</Button>;
  }
  if (action.action === 'awaitLaunch') {
    return <Button intent={intents.launchApp(action.target)} buttonStyle='borderless' frame={{width, height}}>{visual}</Button>;
  }
  const url = actionURL(action);
  if (!url.ok || !url.value) return visual;
  // The user chose Await's documented compatibility route for custom schemes.
  if (action.action === 'scheme') return <Link url={url.value} frame={{width, height}}>{visual}</Link>;
  // Universal Links and named Shortcuts go directly to native Button.url.
  return <Button url={url.value} buttonStyle='borderless' frame={{width, height}}>{visual}</Button>;
}

function TextEditor({config, size}: {config: Config; size: Size}): NativeView {
  const row = currentRow(config) - 1; const column = currentColumn(config) - 1;
  const cell = config.cells[row][column];
  const example = AwaitStore.get<boolean>(EXAMPLE_KEY) ?? false;
  const exampleText = AwaitStore.get<string>(EXAMPLE_TEXT_KEY) ?? '示例文字 Aa 123';
  const colorEditor = AwaitStore.get<boolean>(COLOR_EDITOR_KEY) ?? false;
  const colorDraft = AwaitStore.get<string>(COLOR_DRAFT_KEY) ?? '';
  const examples = ['示例文字 Aa 123', '工作 · 笔记', '较长文字的显示效果 123456789'];
  const width = Math.max(1, size.width - 24);
  const layout = geometry(config, size.width, size.height);
  const fit = flowRowGeometry(config, row, layout.innerWidth, layout.rowHeight);
  const preview = example ? {...cell, title: exampleText || '示例文字 Aa 123', showText: true} : cell;
  const colors = ['#22252f', '#ffffff', '#111111', '#d84c6f', '#ec7c31', '#2b8b65', '#356be3', '#8355bd'];
  return <Scroll frame={size} background='#f1f0f5'>
    <VStack spacing={9} alignment='leading' frame={{width}} padding={12}>
      <Text value='----文字调整----' fontSize={13} fontWeight={700} foreground='#252938' maxWidth/>
      <Text value={`${familyLabel(activeFamily())} · 第${row + 1}行第${column + 1}个按钮`} fontSize={12} foreground='#58635f' maxWidth/>
      <Tile config={config} row={row} group={{column, span: cell.multiple, cell: preview}}
        width={fit.widths[column]} height={fit.height} interactive={false}/>
      <Button intent={intents.toggleTextVisibility()} buttonStyle='borderless' frame={{width, height: 30}}>
        <Text value={`显示文字：${cell.showText ? '开启' : '关闭'}`} fontSize={12} foreground='#252938'
          frame={{width, height: 30}} background='#ffffff' cornerRadius={8}/>
      </Button>
      <Text value={`本尺寸共用文字颜色：${config.foreground}`} fontSize={11} foreground='#58635f' maxWidth/>
      <HStack spacing={6}>
        {colors.map(color => <Button id={`text-color-${color}`} intent={intents.setTextColor(color)} buttonStyle='borderless' frame={{width: 24, height: 24}}>
          <Text value={config.foreground.toLowerCase() === color ? '✓' : ' '} fontSize={13}
            foreground={color === '#ffffff' ? '#22252f' : '#ffffff'} frame={{width: 24, height: 24}} background={color} cornerRadius={12}/>
        </Button>)}
      </HStack>
      <Button intent={intents.toggleColorEditor()} buttonStyle='borderless' frame={{width, height: 30}}>
        <Text value={colorEditor ? '收起自定义颜色' : '自定义颜色 · HEX'} fontSize={12} foreground='#252938'
          frame={{width, height: 30}} background='#ffffff' cornerRadius={8}/>
      </Button>
      {colorEditor ? <VStack spacing={6} alignment='leading' maxWidth>
        <Text value={`#${colorDraft.padEnd(6, '·')} · 六位输入完整后直接应用`} fontSize={11} foreground='#58635f' maxWidth/>
        {['0123', '4567', '89AB', 'CDEF'].map((line, index) => <HStack id={`hex-row-${index}`} spacing={6}>
          {line.split('').map(key => <Button id={`hex-${key}`} intent={intents.colorKey(key)} buttonStyle='borderless' frame={{width: 38, height: 28}}>
            <Text value={key} fontSize={13} foreground='#252938' frame={{width: 38, height: 28}} background='#ffffff' cornerRadius={6}/>
          </Button>)}
        </HStack>)}
        <HStack spacing={6}>
          <Button intent={intents.colorKey('backspace')} buttonStyle='borderless'>
            <Text value='退格' fontSize={12} foreground='#252938' padding={6} background='#ffffff' cornerRadius={6}/>
          </Button>
          <Button intent={intents.colorKey('clear')} buttonStyle='borderless'>
            <Text value='清空输入' fontSize={12} foreground='#252938' padding={6} background='#ffffff' cornerRadius={6}/>
          </Button>
        </HStack>
      </VStack> : undefined}
      <Button intent={intents.toggleTextExample()} buttonStyle='borderless' frame={{width, height: 30}}>
        <Text value={`示例预览：${example ? '开启' : '关闭'}（不写入按钮）`} fontSize={12} foreground='#252938'
          frame={{width, height: 30}} background='#ffffff' cornerRadius={8}/>
      </Button>
      {examples.map((text, index) => <Button id={`example-${index}`} intent={intents.setTextExample(text)} buttonStyle='borderless' frame={{width, height: 28}}>
        <Text value={`示例：${text}`} fontSize={11} foreground='#58635f' lineLimit={1} minimumScaleFactor={0.5}
          frame={{width, height: 28}} background='#ffffff' cornerRadius={6}/>
      </Button>)}
      <Text value={`已保存文字：${cell.title || '（空）'}`} fontSize={11} foreground='#58635f'
        fixedSize={{horizontal: false, vertical: true}} maxWidth/>
      <Text value='文字内容通过下方原生输入框修改。文字颜色在当前尺寸共用；HEX键盘点满六位后直接应用，未填完整时保留原色。显示开关只影响当前按钮，示例仅在此页临时展示。'
        fontSize={11} foreground='#58635f' fixedSize={{horizontal: false, vertical: true}} maxWidth/>
    </VStack>
  </Scroll>;
}

function EditorInfo({config, size}: {config: Config; size: Size}): NativeView {
  const row = currentRow(config); const column = currentColumn(config);
  const selection = selectedOwner(config, row - 1, column - 1);
  const cell = selection.ok ? selection.value.cell : undefined;
  const settings = config.rowSettings[row - 1];
  const alignment = settings.alignment === 'leading' ? '靠左' : settings.alignment === 'trailing' ? '靠右' : '居中';
  const lines = [
    `当前编辑第${row}行·宽度${settings.widthPercent}%·${config.columns[row - 1]}个·间距${settings.gap}·${alignment}`,
    cell ? `当前编辑：第${column}个按钮·${cell.multiple}倍宽` : selection.ok ? '' : selection.message,
    cell ? `动作：${actionLabel(cell.action, cell.target)}` : '',
    cell ? `输入参数：${actionInput(cell)}` : '',
    `${familyLabel(activeFamily())}；${config.rows}行，${config.columns.slice(0, config.rows).join('/')}，背景不透明度:${config.backgroundOpacity}`,
    `行间距${config.gap} 外边距${config.padding} 圆角${config.radius}`,
    cell ? `图片：${cell.showImage ? '显示' : '隐藏'}·${cell.image}` : '',
    cell ? `文字：${cell.title || '（空）'}·${cell.showText ? '显示' : '隐藏'} 文字颜色${config.foreground}` : '',
  ].filter(Boolean);
  return <Scroll frame={size} background='#f1f0f5'>
    <VStack spacing={5} alignment='leading' frame={{width: Math.max(1, size.width - 24)}} padding={12}>
      <Text value='----查看信息----' fontSize={13} fontWeight={700} foreground='#252938' maxWidth/>
      {lines.map((line, index) => <Text id={`editor-${index}`} value={line} fontSize={11} foreground='#252938'
        fixedSize={{horizontal: false, vertical: true}} maxWidth/>)}
    </VStack>
  </Scroll>;
}

function Help({size}: {size: Size}): NativeView {
  const sections = [
    ['配置顺序', '配置说明 → 背景 → 布局 → 行编辑 → 按钮编辑。布局、图片和文字修改后直接保存。【编辑行】输入行号则对该行编辑，【编辑按钮】则是选择对应行的第几个按钮。开启文字调整进入自绘页来编辑，底部仅保留输入框，文字格式在自绘页调整。'],
    ['点击行为与参数', '六种行为共用输入参数：挂载快捷指令只设置shortcut属性，需自行挂载；Univ Link填HTTP/HTTPS网址；AwaitLaunch填Bundle ID；Urlscheme；快捷指令名称填准确名称；无动作忽略参数。点保存点击行为统一应用，校验失败保留原动作。'],
    ['配置导入导出', '只处理Await当前原生预览所选尺寸。复制配置JSON后自行保存为.json；粘贴到导入JSON，点导入并替换后只覆盖当前尺寸，不影响其他尺寸。'],
  ];
  return <Scroll frame={size} background='#f1f0f5'>
    <VStack spacing={10} alignment='leading' frame={{width: Math.max(1, size.width - 24)}} padding={12}>
      <Text value='----配置说明----' fontSize={13} fontWeight={700} foreground='#252938' maxWidth/>
      {sections.map(([title, detail], index) => <VStack id={`help-${index}`} spacing={4} alignment='leading' maxWidth>
        <Text value={title} fontSize={13} fontWeight={700} foreground='#252938' maxWidth/>
        <Text value={detail} fontSize={12} foreground='#4f5665' textAlignment='leading'
          fixedSize={{horizontal: false, vertical: true}} maxWidth/>
      </VStack>)}
    </VStack>
  </Scroll>;
}

function ConfigTransfer({size}: {size: Size}): NativeView {
  const lines = [
    '导出：点击下方原生列表中的“复制配置JSON”，粘贴后另存为.json文件。',
    '导入：把完整JSON粘贴到“导入JSON”，再点“导入并替换”。只粘贴文本不会自动导入。',
    '只导入导出当前原生预览尺寸。成功后替换本尺寸配置。',
    '回到默认值：重置当前尺寸全部配置，其他尺寸和图片文件保留。',
  ];
  const result = AwaitStore.get<string>(TRANSFER_MESSAGE_KEY) ?? '尚未执行导入或导出。';
  return <Scroll frame={size} background='#f1f0f5'>
    <VStack spacing={10} alignment='leading' frame={{width: Math.max(1, size.width - 24)}} padding={12}>
      <Text value='----配置导入导出----' fontSize={15} fontWeight={700} foreground='#252938' maxWidth/>
      <Text value={result} fontSize={12} foreground='#356be3' textAlignment='leading'
        fixedSize={{horizontal: false, vertical: true}} maxWidth/>
      {lines.map((line, index) => <Text id={`transfer-${index}`} value={line} fontSize={12}
        foreground='#4f5665' textAlignment='leading' fixedSize={{horizontal: false, vertical: true}} maxWidth/>)}
    </VStack>
  </Scroll>;
}

function widget(entry: WidgetEntry<EntryData>): NativeView {
  const family = gridFamily(entry.family);
  ensureFamily(family);
  if (AwaitEnv.host === 'app') { useFamily(family); syncPanelChanges(); }
  const config = AwaitEnv.host === 'app' ? load(family)
    : entry.configFamily === family && entry.config ? normalizeConfig(entry.config) : load(family);
  const size = entry.size;
  if (showConfigTransfer && AwaitEnv.host === 'app') return <ConfigTransfer size={size}/>;
  if (showHelp && AwaitEnv.host === 'app') return <Help size={size}/>;
  if (showTextEditor && AwaitEnv.host === 'app') return <TextEditor config={load()} size={size}/>;
  if (showEditorInfo && AwaitEnv.host === 'app') return <EditorInfo config={load()} size={size}/>;
  const layout = geometry(config, size.width, size.height);
  return (
    <ZStack frame={size} background={[config.background, config.backgroundOpacity]}>
      <VStack spacing={layout.gap}>
        {Array.from({length: config.rows}, (_, row) => (
          <FlowLine config={config} row={row} width={layout.innerWidth} height={layout.rowHeight}/>
        ))}
      </VStack>
    </ZStack>
  );
}

function FlowLine({config, row, width, height}: {config: Config; row: number; width: number; height: number}): NativeView {
  const fit = flowRowGeometry(config, row, width, height);
  return <Flow id={`row-${row}`} spacing={fit.gap} rowSpacing={0} alignment='center'
    rowAlignment={config.rowSettings[row].alignment} frame={{width, height}} clipped>
    {groupsForRow(config, row).map((group, index) => <Tile group={group} row={row} config={config}
      width={fit.widths[index]} height={fit.height}/>)}
  </Flow>;
}

const intents = Await.define({widget, widgetTimeline, autoAccented: false,
  widgetIntents: {saveAction, copyConfig, replaceConfig, resetDefaults, launchApp, toggleTextVisibility, setTextColor, toggleTextExample, setTextExample, toggleColorEditor, colorKey}});
