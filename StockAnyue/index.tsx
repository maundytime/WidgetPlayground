import {fetchMarket} from './market';
import {
	currencyOptions,
	parseAssets,
	rebaseRates,
	type Snapshot,
} from './model';
import {Board, type BoardConfig} from './view';

// @panel {type:'strings',min:0,max:16,title_zh:'资产：名称|代码|币种|数量|成本|类型|乘数|链接'}
const assetLines = [
	'苹果|usAAPL|USD|0|0|资产|1|https://gu.qq.com/usAAPL/gp',
	'英伟达|usNVDA|USD|0|0|资产|1|https://gu.qq.com/usNVDA/gp',
	'特斯拉|usTSLA|USD|0|0|资产|1|https://gu.qq.com/usTSLA/gp',
	'贵州茅台|sh600519|CNY|0|0|资产|1|https://gu.qq.com/sh600519/gp',
	'小米集团|hk01810|HKD|0|0|资产|1|https://gu.qq.com/hk01810/gp',
	'纽约黄金|hf_GC|USD|0|0|观察|100|',
	'纽约原油|hf_CL|USD|0|0|观察|1000|',
	'比特币|BTCUSDT|USDT|0|0|资产|1|',
];

// @panel {type:'menu',items:['CNY','USD','HKD','EUR','GBP','JPY'],title_zh:'默认计价币种'}
const baseCurrency = 'CNY';
// @panel {title_zh:'1 USDT 折合默认计价币种（0 表示不折算）'}
const usdtRate = 0;
// @panel {title_zh:'显示资产总览'}
const showSummary = true;
// @panel {title_zh:'显示持仓与行情'}
const showHoldings = true;
// @panel {title_zh:'显示指数分时'}
const showChart = true;
// @panel {title_zh:'显示同类股票对比'}
const showComparison = true;
// @panel {type:'menu',items:['上证指数','深证成指','创业板指'],title_zh:'分时指数'}
const indexName = '上证指数';
// @panel {type:'strings',min:1,max:3,title_zh:'同类对比的股票代码（最多三只）'}
const comparisonSymbols = ['usAAPL', 'usNVDA', 'usTSLA'];
// @panel {type:'menu',items:['原顺序','涨跌幅','市盈率'],title_zh:'对比排序'}
const comparisonSort = '原顺序';
// @panel {type:'menu',items:[1,5,15,30],title_zh:'自动请求间隔（分钟，实际由系统调度）'}
const refreshMinutes = 5;
// @panel {type:'color',title_zh:'背景颜色'}
const background = '#0C1821';
// @panel {type:'color',title_zh:'上涨颜色'}
const upColor = '#FF8178';
// @panel {type:'color',title_zh:'下跌颜色'}
const downColor = '#7AD9B5';

const SNAPSHOT_KEY = 'Stock.snapshot';
const SIGNATURE_KEY = 'Stock.signature';
const REQUEST_KEY = 'Stock.requestedAt';
const PAGE_KEY = 'Stock.page';
const MODE_KEY = 'Stock.mode';
const CURRENCY_KEY = 'Stock.currency';
const CURRENCY_MENU_KEY = 'Stock.currencyMenuOpen';

function configuration(): BoardConfig {
	const indices: Record<string, string> = {上证指数: 'sh000001', 深证成指: 'sz399001', 创业板指: 'sz399006'};
	return {
		assets: parseAssets(assetLines), base: baseCurrency,
		indexSymbol: indices[indexName], indexName,
		comparisonSymbols: showComparison ? comparisonSymbols : [], comparisonSort,
		showSummary, showHoldings, showChart, showComparison, background, up: upColor, down: downColor,
	};
}

function widget(entry: WidgetEntry<{snapshot: Snapshot}>) {
	const config = configuration();
	config.base = AwaitStore.string(CURRENCY_KEY, baseCurrency);
	const snapshot = {...entry.snapshot, rates: rebaseRates(entry.snapshot.rates, config.base)};
	return (
		<Board
			size={entry.size}
			snapshot={snapshot}
			config={config}
			page={AwaitStore.num(PAGE_KEY, 0)}
			mode={AwaitStore.string(MODE_KEY, '持仓')}
			currencyMenuOpen={AwaitStore.bool(CURRENCY_MENU_KEY, false)}
			actions={{
				refresh: app.refresh(), nextPage: app.nextPage(), previousPage: app.previousPage(), toggleMode: app.toggleMode(),
				toggleCurrencyMenu: app.toggleCurrencyMenu(), selectCurrency: currency => app.selectCurrency(currency),
			}}
		/>
	);
}

async function widgetTimeline(): Promise<Timeline<{snapshot: Snapshot}>> {
	const config = configuration();
	const signature = JSON.stringify([assetLines, baseCurrency, usdtRate, showChart, indexName, config.comparisonSymbols, currencyOptions]);
	let snapshot = AwaitStore.get<Snapshot>(SNAPSHOT_KEY);
	const sameConfiguration = AwaitStore.string(SIGNATURE_KEY) === signature;
	const lastRequest = AwaitStore.num(REQUEST_KEY, 0);
	if (!snapshot || !sameConfiguration || Date.now() - lastRequest >= refreshMinutes * 60_000) {
		snapshot = await fetchMarket({
			assets: config.assets, comparisonSymbols: config.comparisonSymbols,
			indexSymbol: config.indexSymbol, showChart, base: baseCurrency, usdtRate,
			previousRates: sameConfiguration ? snapshot?.rates : undefined,
		});
		AwaitStore.set(SNAPSHOT_KEY, snapshot);
		AwaitStore.set(SIGNATURE_KEY, signature);
		AwaitStore.set(REQUEST_KEY, snapshot.fetchedAt);
	}

	return {entries: [{date: new Date(), snapshot}], update: new Date(snapshot.fetchedAt + refreshMinutes * 60_000)};
}

// @panel {title_zh:'立即刷新行情'}
function refresh() {
	AwaitStore.delete(REQUEST_KEY);
}

function nextPage() {
	AwaitStore.set(PAGE_KEY, AwaitStore.num(PAGE_KEY, 0) + 1);
}

function previousPage() {
	AwaitStore.set(PAGE_KEY, AwaitStore.num(PAGE_KEY, 0) - 1);
}

function toggleMode() {
	AwaitStore.set(MODE_KEY, AwaitStore.string(MODE_KEY, '持仓') === '持仓' ? '行情' : '持仓');
}

function toggleCurrencyMenu() {
	AwaitStore.set(CURRENCY_MENU_KEY, !AwaitStore.bool(CURRENCY_MENU_KEY, false));
}

function selectCurrency(currency: string) {
	AwaitStore.set(CURRENCY_KEY, currency);
	AwaitStore.set(CURRENCY_MENU_KEY, false);
}

const app = Await.define({
	widget, widgetTimeline,
	widgetFamilies: ['extraLargePortrait'],
	widgetIntents: {
		refresh, nextPage, previousPage, toggleMode, toggleCurrencyMenu, selectCurrency,
	},
	autoAccented: false,
});
