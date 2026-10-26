import {
	Button,
	Color,
	FullButton,
	HStack,
	Icon,
	Link,
	Spacer,
	Svg,
	Text,
	VStack,
	ZStack,
} from 'await';
import {
	chartSvg,
	currencyOptions,
	localTime,
	money,
	numberText,
	positionFor,
	quoteTime,
	signed,
	summarize,
	type Asset,
	type Position,
	type Quote,
	type Snapshot,
} from './model';

export type BoardConfig = {
	assets: Asset[];
	base: string;
	indexSymbol: string;
	indexName: string;
	comparisonSymbols: string[];
	comparisonSort: string;
	showSummary: boolean;
	showHoldings: boolean;
	showChart: boolean;
	showComparison: boolean;
	background: string;
	up: string;
	down: string;
};

export type BoardActions = {
	refresh: IntentInfo;
	nextPage: IntentInfo;
	previousPage: IntentInfo;
	toggleMode: IntentInfo;
	toggleCurrencyMenu: IntentInfo;
	selectCurrency: (currency: string) => IntentInfo;
};

const colors = {
	text: '#EEF2F2', muted: '#8D9CA6', surface: '#15232C', accent: '#D0E8BC',
};

export function boardLayout(size: Size, config: BoardConfig) {
	const padding = 18;
	const width = size.width - padding * 2;
	const height = size.height - padding * 2;
	const gap = 9;
	const header = 26;
	const footer = 14;
	const summary = 70;
	const comparison = 74;
	const chart = 104;
	const contentHeight = height - header - footer - gap * 2 - (config.showSummary ? summary + gap : 0);
	const tableHeight = contentHeight - (config.showChart ? chart + gap : 0) - (config.showComparison ? comparison + gap : 0);
	const rows = Math.max(1, Math.min(10, Math.floor((tableHeight - 42) / 33)));
	return {
		padding, width, height, gap, header, footer, summary, comparison, contentHeight, chartHeight: chart, tableHeight, rows,
	};
}

function trend(value: number, config: BoardConfig): string {
	return value === 0 ? colors.muted : (value > 0 ? config.up : config.down);
}

function Action({intent, symbol}: {intent: IntentInfo; symbol: string}) {
	return (
		<Button intent={intent} buttonStyle='borderless'>
			<Icon value={symbol} fontSize={12} foreground={colors.text} frame={{width: 28, height: 24}} background={colors.surface} cornerRadius={8}/>
		</Button>
	);
}

function AssetHeader({config, actions}: {config: BoardConfig; actions: BoardActions}) {
	return (
		<HStack spacing={8} height={26}>
			<Icon value='chart.bar.xaxis' fontSize={15} foreground={colors.accent}/>
			<Text value='资产看板' fontSize={15} fontWeight={700}/>
			<Spacer/>
			<Button intent={actions.toggleCurrencyMenu} buttonStyle='borderless'>
				<HStack spacing={6} padding={{horizontal: 9}} height={26} background={colors.surface} cornerRadius={8}>
					<Text value={config.base} fontSize={11} foreground={colors.accent} monospaced/>
					<Icon value='chevron.down' fontSize={8} foreground={colors.accent}/>
				</HStack>
			</Button>
			{config.showChart ? undefined : <Action intent={actions.refresh} symbol='arrow.clockwise'/>}
		</HStack>
	);
}

function Summary({positions, config}: {positions: Position[]; config: BoardConfig}) {
	const total = summarize(positions);
	const unconfigured = total.count === 0;
	const awaitingRates = !unconfigured && total.converted === 0;
	let value = money(total.value, config.base);
	if (unconfigured) {
		value = '未录入持仓';
	} else if (awaitingRates) {
		value = '待设折算汇率';
	}

	return (
		<HStack spacing={10} alignment='top' padding={10} height={70} background={colors.surface} cornerRadius={12}>
			<VStack alignment='leading' spacing={4} maxWidth>
				<Text value={total.partial ? '已折算资产市值' : '资产市值 · 不含期货'} fontSize={9} foreground={colors.muted}/>
				<Text value={value} fontSize={21} fontWeight={600} monospacedDigit minimumScaleFactor={0.6} maxWidth/>
				<Text value={unconfigured ? '在面板填写数量与成本' : `成本 ${money(total.cost, config.base)}`} fontSize={9} foreground={colors.muted} monospacedDigit/>
			</VStack>
			<VStack alignment='trailing' spacing={4} maxWidth>
				<Text value={total.partial ? `浮盈亏 · 已折算 ${total.converted}/${total.count}` : '持仓浮盈亏'} fontSize={9} foreground={colors.muted}/>
				<Text value={unconfigured || awaitingRates ? '—' : `${signed(total.pnl)} ${config.base}`} fontSize={17} fontWeight={600} foreground={trend(total.pnl, config)} monospacedDigit minimumScaleFactor={0.6}/>
				<Text value={total.futures ? '含期货估算盈亏' : '按当前参考汇率折算'} fontSize={9} foreground={colors.muted}/>
			</VStack>
		</HStack>
	);
}

function Chart({snapshot, config, width, height, refresh}: {snapshot: Snapshot; config: BoardConfig; width: number; height: number; refresh: IntentInfo}) {
	const quote = snapshot.quotes[config.indexSymbol];
	const series = snapshot.series[config.indexSymbol];
	const color = trend(quote.percent, config);
	const date = `${series.date.slice(0, 4)}-${series.date.slice(4, 6)}-${series.date.slice(6, 8)}`;
	const closeTime = `${series.time.slice(0, 2)}:${series.time.slice(2)}`;
	return (
		<VStack alignment='leading' spacing={4} height={height}>
			<HStack spacing={6} height={24}>
				<Text value={config.indexName} fontSize={13} fontWeight={600}/>
				<Text value={numberText(quote.price)} fontSize={17} fontWeight={600} monospacedDigit/>
				<Text value={`${signed(quote.percent)}%`} fontSize={11} foreground={color} monospacedDigit/>
				<Spacer/>
				<Action intent={refresh} symbol='arrow.clockwise'/>
			</HStack>
			<Svg value={chartSvg(series, series.previous, color)} frame={{width, height: height - 47}}/>
			<HStack height={15} fontSize={8} foreground={colors.muted}>
				<Text value='09:30'/>
				<Spacer/>
				<Text value={`${date} ${closeTime} 北京`}/>
				<Spacer/>
				<Text value='15:00'/>
			</HStack>
		</VStack>
	);
}

function Cell({top, bottom, width, color = colors.text, leading = false}: {top: string; bottom: string; width: number; color?: string; leading?: boolean}) {
	return (
		<VStack alignment={leading ? 'leading' : 'trailing'} spacing={3} frame={{width, height: 32}}>
			<Text value={top} fontSize={11} fontWeight={500} foreground={color} monospacedDigit minimumScaleFactor={0.7}/>
			<Text value={bottom} fontSize={8} foreground={colors.muted} monospacedDigit minimumScaleFactor={0.7}/>
		</VStack>
	);
}

function PositionRow({position, width, mode, config}: {position: Position; width: number; mode: string; config: BoardConfig}) {
	const {asset, quote} = position;
	const widths = [width * 0.24, width * 0.25, width * 0.25, width * 0.26];
	const time = quote.asOf === undefined ? undefined : quoteTime(quote.asOf);
	let pnlDetail = '未计入持仓';
	if (position.pnl !== undefined) {
		pnlDetail = '未设折算汇率';
		if (asset.currency === config.base) {
			pnlDetail = asset.currency;
			if (position.returnPercent !== undefined) {
				pnlDetail += ` · ${signed(position.returnPercent)}%`;
			}
		} else if (position.basePnl !== undefined) {
			pnlDetail = money(position.basePnl, config.base);
		}
	}

	const content = mode === '行情'
		? (
			<HStack height={33}>
				<Cell top={asset.name} bottom={asset.symbol} width={widths[0]} leading/>
				<Cell top={numberText(quote.price)} bottom={asset.currency} width={widths[1]}/>
				<Cell top={`${signed(quote.percent)}%`} bottom={quote.change === undefined ? '未提供涨跌额' : signed(quote.change)} width={widths[2]} color={trend(quote.percent, config)}/>
				<Cell top={time === undefined ? '未提供' : time.slice(6)} bottom={time === undefined ? '源更新时间' : `${time.slice(0, 5)} ${quote.zone} · ${quote.period}`} width={widths[3]}/>
			</HStack>
		)
		: (
			<HStack height={33}>
				<Cell top={asset.name} bottom={`${asset.currency}${asset.kind === '期货' ? ' · 期货' : ''}`} width={widths[0]} leading/>
				<Cell top={position.pnl === undefined ? '观察' : `${asset.quantity}${asset.kind === '期货' ? ' 手' : ''}`} bottom={position.pnl === undefined ? asset.symbol : money(asset.cost, asset.currency)} width={widths[1]}/>
				<Cell top={numberText(quote.price)} bottom={`${signed(quote.percent)}% · ${quote.period}`} width={widths[2]} color={trend(quote.percent, config)}/>
				<Cell
					top={position.pnl === undefined ? '—' : signed(position.pnl)}
					bottom={pnlDetail}
					width={widths[3]}
					color={position.pnl === undefined ? colors.muted : trend(position.pnl, config)}
				/>
			</HStack>
		);
	return asset.url ? <Link url={asset.url}>{content}</Link> : content;
}

function Holdings({positions, config, width, height, rows, page, mode, actions}: {
	positions: Position[]; config: BoardConfig; width: number; height: number; rows: number; page: number; mode: string; actions: BoardActions;
}) {
	const pages = Math.max(1, Math.ceil(positions.length / rows));
	const currentPage = (page % pages + pages) % pages;
	const visible = positions.slice(currentPage * rows, (currentPage + 1) * rows);
	const labels = mode === '行情' ? ['资产', '现价', '涨跌', '行情时间'] : ['资产', '数量 / 成本', '现价 / 涨跌', '浮盈亏'];
	return (
		<VStack alignment='leading' spacing={0} height={height}>
			<HStack spacing={6} height={24}>
				<Text value={mode === '行情' ? '自选行情' : '持仓与观察'} fontSize={11} fontWeight={600}/>
				<Button intent={actions.toggleMode} buttonStyle='borderless'><Text value={mode === '行情' ? '看持仓' : '看行情'} fontSize={9} foreground={colors.accent} frame={{width: 44, height: 24}}/></Button>
				<Spacer/>
				<Text value={`${currentPage + 1}/${pages}`} foreground={colors.muted} fontSize={9} monospaced/>
				<Action intent={actions.previousPage} symbol='chevron.left'/>
				<Action intent={actions.nextPage} symbol='chevron.right'/>
			</HStack>
			<HStack height={18} fontSize={8} foreground={colors.muted}>
				{labels.map((label, index) => <Text value={label} frame={{width: width * [0.24, 0.25, 0.25, 0.26][index], alignment: index === 0 ? 'leading' : 'trailing'}}/>)}
			</HStack>
			{visible.map(position => <PositionRow position={position} config={config} width={width} mode={mode}/>)}
			<Spacer/>
		</VStack>
	);
}

function positivePE(quote: Quote): number {
	return quote.pe !== undefined && quote.pe > 0 ? quote.pe : Infinity;
}

function Comparison({snapshot, config, height}: {snapshot: Snapshot; config: BoardConfig; height: number}) {
	const quotes = config.comparisonSymbols.map(symbol => snapshot.quotes[symbol]);
	if (config.comparisonSort === '涨跌幅') {
		quotes.sort((left, right) => right.percent - left.percent);
	} else if (config.comparisonSort === '市盈率') {
		quotes.sort((left, right) => positivePE(left) - positivePE(right));
	}

	return (
		<VStack alignment='leading' spacing={4} padding={8} height={height} background={colors.surface} cornerRadius={10}>
			<HStack height={12}>
				<Text value='同类对比' fontSize={10} fontWeight={600}/>
				<Spacer/>
				<Text value={config.comparisonSort === '原顺序' ? '价格 · 涨跌 · 市盈率' : `按${config.comparisonSort}排序`} fontSize={8} foreground={colors.muted}/>
			</HStack>
			<HStack spacing={10} alignment='top'>
				{quotes.map(quote => {
					const asset = config.assets.find(item => item.symbol === quote.symbol);
					const name = asset?.name ?? quote.symbol;
					return (
						<VStack alignment='leading' spacing={2} maxWidth>
							<Text value={name} fontSize={10} fontWeight={600}/>
							<Text value={`${numberText(quote.price)}  ${signed(quote.percent)}%`} fontSize={9} foreground={trend(quote.percent, config)} monospacedDigit minimumScaleFactor={0.7}/>
							<Text value={`PE ${quote.pe !== undefined && quote.pe > 0 ? numberText(quote.pe, 1) : '—'} · ${quote.zone}`} fontSize={8} foreground={colors.muted}/>
						</VStack>
					);
				})}
			</HStack>
		</VStack>
	);
}

function CurrencyMenu({size, config, actions}: {size: Size; config: BoardConfig; actions: BoardActions}) {
	const width = size.width - 36;
	const names: Record<string, string> = {
		CNY: '人民币', USD: '美元', HKD: '港币', EUR: '欧元', GBP: '英镑', JPY: '日元',
	};
	return (
		<ZStack frame={size}>
			<FullButton intent={actions.toggleCurrencyMenu} background='#00000088'/>
			<VStack spacing={8} padding={14} width={width} foreground={colors.text} lineLimit={1} background={colors.surface} cornerRadius={16}>
				<HStack height={26}>
					<Text value='计价币种' fontSize={14} fontWeight={600}/>
					<Spacer/>
					<Action intent={actions.toggleCurrencyMenu} symbol='xmark'/>
				</HStack>
				{[0, 2, 4].map(start => (
					<HStack spacing={8}>
						{currencyOptions.slice(start, start + 2).map(currency => (
							<Button intent={actions.selectCurrency(currency)} buttonStyle='borderless'>
								<HStack spacing={6} padding={10} frame={{width: (width - 36) / 2, height: 44}} background={currency === config.base ? '#2B4246' : config.background} cornerRadius={9}>
									<VStack alignment='leading' spacing={2}>
										<Text value={currency} fontSize={12} fontWeight={600} monospaced/>
										<Text value={names[currency]} fontSize={9} foreground={colors.muted}/>
									</VStack>
									<Spacer/>
									<Icon value='checkmark' fontSize={11} foreground={colors.accent} opacity={currency === config.base ? 1 : 0}/>
								</HStack>
							</Button>
						))}
					</HStack>
				))}
			</VStack>
		</ZStack>
	);
}

export function Board({size, snapshot, config, actions, page, mode, currencyMenuOpen}: {size: Size; snapshot: Snapshot; config: BoardConfig; actions: BoardActions; page: number; mode: string; currencyMenuOpen: boolean}) {
	const layout = boardLayout(size, config);
	const positions = config.assets.map(asset => positionFor(asset, snapshot.quotes[asset.symbol], snapshot.rates));
	const summary = config.showSummary ? <Summary positions={positions} config={config}/> : undefined;
	const chart = config.showChart ? <Chart snapshot={snapshot} config={config} width={layout.width} height={layout.chartHeight} refresh={actions.refresh}/> : undefined;
	const holdings = config.showHoldings ? <Holdings positions={positions} config={config} width={layout.width} height={layout.tableHeight} rows={layout.rows} page={page} mode={mode} actions={actions}/> : undefined;
	const comparison = config.showComparison ? <Comparison snapshot={snapshot} config={config} height={layout.comparison}/> : undefined;
	return (
		<ZStack frame={size} clipped>
			<Color value={config.background}/>
			<VStack spacing={layout.gap} foreground={colors.text} lineLimit={1} frame={{width: layout.width, height: layout.height}}>
				<VStack spacing={layout.gap} frame={{height: layout.contentHeight, alignment: 'top'}}>{chart}{holdings}{comparison}</VStack>
				<AssetHeader config={config} actions={actions}/>
				{summary}
				<HStack height={layout.footer} fontSize={8} foreground={colors.muted}>
					<Text value={`获取 ${localTime(snapshot.fetchedAt)} · 非实时`}/>
					<Spacer/>
					<Text value={`参考汇率 ${snapshot.rates.date.slice(5)} · ${config.base}`}/>
				</HStack>
			</VStack>
			{currencyMenuOpen ? <CurrencyMenu size={size} config={config} actions={actions}/> : undefined}
		</ZStack>
	);
}
