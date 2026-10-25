import {
	VStack,
	Image,
	Text,
	ZStack,
	FullButton,
} from 'await';

// @panel {type:'strings',min:1,title:'First Row',title_zh:'第一行'}
const value1 = [
	'数据库1',
	'数据库2',
	'数据库3',
	'数据库4',
];
// @panel {type:'strings',min:1,title:'Second Row',title_zh:'第二行'}
const value2 = [
	'数据库1',
	'数据库2',
	'数据库3',
	'数据库4',
];
// @panel {type:'color',title:'Text Color',title_zh:'文本颜色'}
const foreground = 'ffffff99';
// @panel {type:'slider',min:8,max:72,step:1,title:'Font Size',title_zh:'字体大小'}
const fontSize = 14;
// @panel {type:'slider',min:100,max:900,step:100,title:'Font Weight',title_zh:'字体粗细'}
const fontWeight = 800;
// @panel {type:'menu',items:['monospaced','rounded','serif','default'],title:'Font Design',title_zh:'字体风格'}
const fontDesign = 'rounded';
// @panel {title:'Font URL',title_zh:'字体路径'}
const fontURL = '';
// @panel {type:'menu',items:['center','leading','trailing'],title:'Text Alignment',title_zh:'文字对齐'}
const textAlignment = 'center';
// @panel {type:'slider',min:8,max:32,step:1,title:'Row Height',title_zh:'行高'}
const rowHeight = 24;

const values = [value1, value2];

const font: Mods =
	fontURL === ''
		? {
			fontSize,
			fontWeight,
			fontDesign,
		}
		: {
			font: {url: fontURL, size: fontSize, wght: fontWeight},
		};

function Quote({size}: {size?: Size}) {
	const content = (
		<VStack textAlignment={textAlignment} foreground={foreground}>
			{Array.from({length: 2}, (_, i) => <Text
				value={values[i][AwaitEnv.tag - 1]}
				{...font}
				frame={size}
			/>)}
		</VStack>
	);
	return fontURL === '' ? content : <Image accented='fullColor'>{content}</Image>;
}

function widget({size}: {size: Size}) {
	const itemSize = {
		width: size.width + 32,
		height: rowHeight,
	};
	return (
		<ZStack>
			<Quote size={itemSize} />
			<VStack>
				<FullButton shortcut={0} />
				<FullButton shortcut={1} />
			</VStack>
		</ZStack>
	);
}

Await.define({widget});
