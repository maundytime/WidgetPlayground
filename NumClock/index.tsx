import {
	Image,
	Text,
	ZStack,
	VStack,
	HStack,
	Rectangle,
} from 'await';

// @panel {type:'slider',min:1,max:128,step:1,title_zh:'时钟字体'}
const fontStyle = 86;

// @panel {type:'slider',min:32,max:128,step:1,title_zh:'字体大小'}
const fontSize = 106;

// @panel {type:'slider',min:-128,max:0,step:1,title_zh:'行间距'}
const rowSpacing = -64;

// @panel {type:'slider',min:-32,max:32,step:1,title_zh:'字间距'}
const letterSpacing = -8;

// @panel {type:'slider',min:-32,max:32,step:1,title_zh:'Y 偏移'}
const offsetY = 0;

// @panel {type:'menu',items:['晴蓝','珊橙','海棠','湖蓝'],title_zh:'色彩方案'}
const colorScheme = '湖蓝';

// @panel {title_zh:'背景透明'}
const transparentBackground = false;

// @panel {type:'menu',items:['24h','12h'],title_zh:'时间制式'}
const timeFormat = '24h';

// 每行一深一浅；浅色适当收敛饱和度，上下两组保持相近的视觉重量。
const colorSchemes: Record<string, [string, string, string, string]> = {
	晴蓝: ['#739BE9', '#9AB8F3', '#6BB9E3', '#96D0EF'],
	珊橙: ['#F38A75', '#F6A992', '#EEA659', '#F3BF80'],
	海棠: ['#E77E88', '#F0A0A6', '#ED957E', '#F4B39D'],
	湖蓝: ['#6CAAE9', '#96C3F0', '#63C8CA', '#90DAD6'],
};

const numeralFonts = AwaitFile.files('fonts')
	.flatMap(folder => AwaitFile.files(`fonts/${folder}`)
		.filter(file => file.endsWith('.ttf'))
		.map(file => `fonts/${folder}/${file}`))
	.toSorted();

function widget({size, date}: WidgetEntry) {
	const font = {
		url: numeralFonts[fontStyle - 1], size: fontSize, monospacedDigit: true,
	};
	const colors = colorSchemes[colorScheme];
	const hour = date.getHours();
	const displayHours: Record<string, number> = {'24h': hour, '12h': (hour + 11) % 12 + 1};
	const hours = String(displayHours[timeFormat]).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');

	return (
		<ZStack contentTransition='identity' animation={0}>
			<Image accented='fullColor'>
				<ZStack frame={size}>
					{transparentBackground ? undefined : <Rectangle fill='#FFFFFF'/>}
					<VStack font={font} spacing={rowSpacing} offset={{x: 0, y: offsetY}}>
						<HStack spacing={letterSpacing}>
							<Text value={hours[0]} foreground={colors[0]} rotationEffect={4}/>
							<Text value={hours[1]} foreground={colors[1]} rotationEffect={-2.7}/>
						</HStack>
						<HStack spacing={letterSpacing}>
							<Text value={minutes[0]} foreground={colors[2]} rotationEffect={2}/>
							<Text value={minutes[1]} foreground={colors[3]} rotationEffect={-3.3}/>
						</HStack>
					</VStack>
				</ZStack>
			</Image>
		</ZStack>
	);
}

function widgetTimeline(): Timeline {
	const now = new Date();
	const minute = Math.floor(now.getTime() / 60_000) * 60_000;
	return {
		entries: Array.from({length: 31}, (_, index) => ({
			date: index === 0 ? now : new Date(minute + index * 60_000),
		})),
		update: new Date(minute + 30 * 60_000),
	};
}

Await.define({
	widget, widgetTimeline, widgetFamilies: ['small'], autoAccented: false,
});
