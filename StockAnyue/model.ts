export type AssetKind = '资产' | '期货' | '观察';

export const currencyOptions = ['CNY', 'USD', 'HKD', 'EUR', 'GBP', 'JPY'];

export type Asset = {
	name: string;
	symbol: string;
	currency: string;
	quantity: number;
	cost: number;
	kind: AssetKind;
	multiplier: number;
	url: string;
};

export type Quote = {
	symbol: string;
	price: number;
	previous?: number;
	change?: number;
	percent: number;
	high?: number;
	low?: number;
	pe?: number;
	asOf?: string;
	zone: string;
	period: string;
};

export type SeriesPoint = {minute: number; price: number};
export type IndexSeries = {date: string; time: string; previous: number; points: SeriesPoint[]};
export type ExchangeRates = {date: string; fetchedDay: string; toBase: Record<string, number>};
export type Snapshot = {
	quotes: Record<string, Quote>;
	series: Record<string, IndexSeries>;
	rates: ExchangeRates;
	fetchedAt: number;
};

export function rebaseRates(rates: ExchangeRates, base: string): ExchangeRates {
	const toBase: Record<string, number> = {};
	for (const [currency, rate] of Object.entries(rates.toBase)) {
		toBase[currency] = rate / rates.toBase[base];
	}

	return {date: rates.date, fetchedDay: rates.fetchedDay, toBase};
}

export type Position = {
	asset: Asset;
	quote: Quote;
	pnl?: number;
	returnPercent?: number;
	basePnl?: number;
	baseValue?: number;
	baseCost?: number;
};

export function parseAssets(lines: string[]): Asset[] {
	const kinds: Record<string, AssetKind> = {资产: '资产', 期货: '期货', 观察: '观察'};
	return lines.map(line => {
		const [name, symbol, currency, quantity, cost, kind, multiplier, url = ''] = line.split('|').map(field => field.trim());
		return {
			name, symbol, currency, quantity: Number(quantity), cost: Number(cost),
			kind: kinds[kind], multiplier: Number(multiplier), url,
		};
	});
}

export function positionFor(asset: Asset, quote: Quote, rates: ExchangeRates): Position {
	const position: Position = {asset, quote};
	if (asset.kind === '观察' || asset.quantity === 0) {
		return position;
	}

	const units = asset.quantity * asset.multiplier;
	position.pnl = (quote.price - asset.cost) * units;
	if (asset.kind === '资产' && asset.cost > 0) {
		position.returnPercent = (quote.price / asset.cost - 1) * 100 * Math.sign(units);
	}

	const rate = rates.toBase[asset.currency];
	if (rate !== undefined) {
		position.basePnl = position.pnl * rate;
		if (asset.kind === '资产') {
			position.baseValue = quote.price * units * rate;
			position.baseCost = asset.cost * units * rate;
		}
	}

	return position;
}

export function summarize(positions: Position[]) {
	const held = positions.filter(position => position.pnl !== undefined);
	const converted = held.filter((position): position is Position & {basePnl: number} => position.basePnl !== undefined);
	const value = converted.reduce((sum, position) => sum + (position.baseValue ?? 0), 0);
	const cost = converted.reduce((sum, position) => sum + (position.baseCost ?? 0), 0);
	const pnl = converted.reduce((sum, position) => sum + position.basePnl, 0);
	return {
		value, cost, pnl, count: held.length, converted: converted.length,
		futures: held.some(position => position.asset.kind === '期货'),
		partial: converted.length !== held.length,
	};
}

export function tradingMinute(hhmm: string): number {
	const hour = Number(hhmm.slice(0, 2));
	const minute = Number(hhmm.slice(2));
	const elapsed = hour * 60 + minute - 570;
	return elapsed > 120 ? elapsed - 90 : elapsed;
}

export function chartSvg(series: IndexSeries, previous: number, color: string): string {
	const width = 640;
	const height = 120;
	const prices = [previous, ...series.points.map(point => point.price)];
	const low = Math.min(...prices);
	const high = Math.max(...prices);
	const span = Math.max(high - low, Math.abs(previous) * 0.002);
	const top = (high + low + span) / 2;
	const y = (price: number) => 10 + (top - price) / span * 100;
	const path = series.points.map((point, index) => `${index === 0 ? 'M' : 'L'}${(point.minute / 240 * width).toFixed(1)},${y(point.price).toFixed(1)}`).join(' ');
	const [last] = series.points.slice(-1);
	const endX = last.minute / 240 * width;
	const endY = y(last.price);
	const firstX = series.points[0].minute / 240 * width;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${color}" stop-opacity="0.20"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="M0 ${y(previous).toFixed(1)}H640" stroke="#52616c" stroke-width="1" stroke-dasharray="5 5"/><path d="M320 0V120" stroke="#26343b" stroke-width="1"/><path d="${path} L${endX.toFixed(1)},120 L${firstX.toFixed(1)},120 Z" fill="url(#area)"/><path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="${endX.toFixed(1)}" cy="${endY.toFixed(1)}" r="3" fill="${color}"/></svg>`;
}

export function numberText(value: number, digits = 2): string {
	const [integer, fraction] = Math.abs(value).toFixed(digits).split('.');
	const groups: string[] = [];
	for (let end = integer.length; end > 0; end -= 3) {
		groups.unshift(integer.slice(Math.max(0, end - 3), end));
	}

	return `${value < 0 ? '−' : ''}${groups.join(',')}${digits > 0 ? `.${fraction}` : ''}`;
}

export function signed(value: number, digits = 2): string {
	return `${value >= 0 ? '+' : '−'}${numberText(Math.abs(value), digits)}`;
}

export function money(value: number, currency: string): string {
	const marks: Record<string, string> = {
		CNY: '¥', USD: '$', HKD: 'HK$', EUR: '€', GBP: '£', JPY: 'JP¥', USDT: '₮',
	};
	const mark = marks[currency];
	return `${mark ?? `${currency} `}${numberText(value, currency === 'JPY' ? 0 : 2)}`;
}

export function quoteTime(asOf: string): string {
	if (asOf.includes('T')) {
		return `${asOf.slice(5, 10)} ${asOf.slice(11, 16)}`;
	}

	if (/^\d{14}$/.test(asOf)) {
		return `${asOf.slice(4, 6)}-${asOf.slice(6, 8)} ${asOf.slice(8, 10)}:${asOf.slice(10, 12)}`;
	}

	return asOf.slice(5, 16).replaceAll('/', '-');
}

export function localTime(timestamp: number): string {
	const date = new Date(timestamp);
	return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
