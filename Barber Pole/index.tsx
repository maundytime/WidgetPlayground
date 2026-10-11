import {
	Color,
	Gif,
	Svg,
	ZStack,
} from 'await';

// @panel {type:'slider',min:2,max:120,step:2,title_zh:'总帧数',title_en:'Frame count'}
const frameCount = 60;
// @panel {type:'menu',items:['向上','向下'],title_zh:'旋转方向',title_en:'Rotation direction'}
const direction = '向上';

const duration: GifDuration = 4;

const designSide = 170;
const pitch = 176;
const stripeHeight = 198.172;
const blueOffset = pitch / 2;
const pairHeight = stripeHeight + blueOffset;
const frameOrder = {向上: 1, 向下: -1}[direction];
const frames = Array.from({length: frameCount}, (_, index) => index);
const pairs = [-1, 0, 1];

function widget(entry: WidgetEntry) {
	const {size} = entry;
	const scale = size.height / designSide;
	const stripeSize = {width: size.width, height: stripeHeight * scale};

	return (
		<ZStack frame={size} clipped>
			<Gif size={size} duration={duration}>
				{frames.map(index => {
					const phase = ((index * frameOrder + frameCount) % frameCount) / frameCount;
					const offset = -phase * pitch;

					return (
						<ZStack frame={size} clipped>
							<Color value='#F6F9FC'/>
							{pairs.map(pair => (
								<Svg
									url='assets/stripes.svg'
									frame={stripeSize}
									shadow={{
										color: '#2370d2',
										blur: 0,
										x: 0,
										y: blueOffset * scale,
									}}
									frame_={{width: size.width, height: pairHeight * scale, alignment: 'top'}}
									drawingGroup
									position={{
										x: size.width / 2,
										y: (pair * pitch + offset + pairHeight / 2) * scale,
									}}
								/>
							))}
						</ZStack>
					);
				})}
			</Gif>
			<Svg url='assets/glass.svg' frame={size}/>
		</ZStack>
	);
}

Await.define({
	widget,
	widgetFamilies: ['small'],
});
