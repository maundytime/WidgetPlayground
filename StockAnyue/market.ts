import {
	currencyOptions,
	tradingMinute,
	type Asset,
	type ExchangeRates,
	type IndexSeries,
	type Quote,
	type Snapshot,
} from './model';

function parseJSON<T>(response: string): T {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Provider responses use their fixed data schemas.
	return JSON.parse(response);
}

export function parseTencent(response: string): Quote[] {
	return response.trim().split('\n').map(line => {
		const [variable, quoted] = line.trim().split('=');
		const symbol = variable.slice(2);
		const payload = quoted.slice(1, -2);
		if (symbol.startsWith('hf_')) {
			const fields = payload.split(',');
			const price = Number(fields[0]);
			const previous = Number(fields[7]);
			return {
				symbol, price, previous, change: price - previous, percent: Number(fields[1]),
				high: Number(fields[4]), low: Number(fields[5]),
				asOf: `${fields[12]} ${fields[6]}`, zone: '源时间', period: '报价期',
			};
		}

		const fields = payload.split('~');
		return {
			symbol, price: Number(fields[3]), previous: Number(fields[4]),
			change: Number(fields[31]), percent: Number(fields[32]),
			high: Number(fields[33]), low: Number(fields[34]),
			pe: fields[39] === '' ? undefined : Number(fields[39]),
			asOf: fields[30], zone: symbol.startsWith('us') ? '美东' : '北京', period: '当日',
		};
	});
}

type CoinLoreTicker = {
	id: string;
	price_usd: string;
	percent_change_24h: string;
};

export function parseCoinLore(response: string): Quote[] {
	return parseJSON<CoinLoreTicker[]>(response).map(ticker => ({
		symbol: `coin_${ticker.id}`, price: Number(ticker.price_usd),
		percent: Number(ticker.percent_change_24h), zone: 'CoinLore', period: '24h',
	}));
}

type MinuteResponse = {data: Record<string, {data: {date: string; data: string[]}; qt: Record<string, string[]>}>};

export function parseSeries(response: string, symbol: string): IndexSeries {
	const value = parseJSON<MinuteResponse>(response);
	const series = value.data[symbol].data;
	const [lastLine] = series.data.slice(-1);
	return {
		date: series.date,
		time: lastLine.split(' ', 1)[0],
		previous: Number(value.data[symbol].qt[symbol][4]),
		points: series.data.map(line => {
			const [time, price] = line.split(' ');
			return {minute: tradingMinute(time), price: Number(price)};
		}),
	};
}

type RatesResponse = {date: string; rates: Record<string, number>};

export function parseRates(response: string, base: string): ExchangeRates {
	const value = parseJSON<RatesResponse>(response);
	const toBase: Record<string, number> = {[base]: 1};
	for (const [currency, rate] of Object.entries(value.rates)) {
		toBase[currency] = 1 / rate;
	}

	return {
		date: value.date, fetchedDay: new Date().toISOString().slice(0, 10),
		toBase,
	};
}

export async function fetchMarket(config: {
	assets: Asset[];
	comparisonSymbols: string[];
	indexSymbol: string;
	showChart: boolean;
	base: string;
	previousRates?: ExchangeRates;
}): Promise<Snapshot> {
	const symbols = [...new Set([
		...config.assets.map(asset => asset.symbol),
		...config.comparisonSymbols,
		...(config.showChart ? [config.indexSymbol] : []),
	])];
	const equities = symbols.filter(symbol => !symbol.startsWith('coin_'));
	const crypto = symbols.filter(symbol => symbol.startsWith('coin_'));
	const currencies = [...new Set([...currencyOptions, ...config.assets.map(asset => asset.currency)])].filter(currency => currency !== config.base);
	const day = new Date().toISOString().slice(0, 10);
	const [quotes, cryptoQuotes, series, rates] = await Promise.all([
		equities.length === 0 ? [] : AwaitNetwork.request(`https://qt.gtimg.cn/q=${equities.join(',')}`).then(response => parseTencent(response.data)),
		Promise.all(crypto.map(async symbol => {
			const response = await AwaitNetwork.request(`https://api.coinlore.net/api/ticker/?id=${encodeURIComponent(symbol.slice(5))}`);
			return parseCoinLore(response.data);
		})).then(results => results.flat()),
		config.showChart ? AwaitNetwork.request(`https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${config.indexSymbol}`).then(response => ({[config.indexSymbol]: parseSeries(response.data, config.indexSymbol)})) : {},
		config.previousRates?.fetchedDay === day
			? config.previousRates
			: AwaitNetwork.request(`https://api.frankfurter.dev/v1/latest?base=${config.base}&symbols=${currencies.join(',')}`).then(response => parseRates(response.data, config.base)),
	]);
	return {
		quotes: Object.fromEntries([...quotes, ...cryptoQuotes].map(quote => [quote.symbol, quote])), series, rates, fetchedAt: Date.now(),
	};
}
