import {
	FullButton,
	Image,
	YFlip,
	ZStack,
} from 'await';

const images = AwaitFile.files('card').map(name => `card/${name}`);
const covers = AwaitFile.files('cover').map(name => `cover/${name}`);
// @panel {type:'slider',min:200,max:3000,step:100,title:'Max Pixel',title_zh:'最大像素'}
const maxPixel = 700;

// @panel {title:'Random Rotation',title_zh:'随机旋转'}
const randomRotation = false;

const stateKey = 'jiaobei.flip';

type ShuffleData = {
	cover: string;
	curr: string;
	index: number;
	rotation: number;
};

function randomImage(files: string[]): string {
	return files[Math.floor(Math.random() * files.length)];
}

function currentState(): ShuffleData {
	const stored = AwaitStore.get<ShuffleData>(stateKey);
	if (stored) {
		return stored;
	}

	const state: ShuffleData = {
		cover: randomImage(covers),
		curr: randomImage(images),
		index: 0,
		rotation: 0,
	};
	AwaitStore.set(stateKey, state);
	return state;
}

function shuffle() {
	const state = currentState();
	if (state.index % 2 === 0) {
		AwaitStore.set(stateKey, {
			...state,
			curr: randomImage(images),
			index: state.index + 9,
			rotation: randomRotation ? Math.floor(Math.random() * 2) * 180 : 0,
		});
	} else {
		resetShuffle();
	}
}

// @panel {title:'Reset to Cover',title_zh:'回到封面'}
function resetShuffle() {
	const state = currentState();
	AwaitStore.set(stateKey, {
		...state,
		cover: randomImage(covers),
		index: state.index + state.index % 2,
		rotation: 0,
	});
}

function faceView(img: string): NativeView {
	return (
		<Image
			url={img}
			resizable
			aspectRatio='fill'
			maxPixel={maxPixel}
			cornerRadius={86 / 3}
			id={img}
		/>
	);
}

function widget(entry: WidgetEntry<ShuffleData>) {
	const showingCover = entry.index % 2 === 0;
	const coverView = faceView(entry.cover);
	const cardView = faceView(entry.curr);

	return (
		<ZStack frame={entry.size} contentTransition='identity'>
			<YFlip
				index={entry.index}
				curr={showingCover ? coverView : cardView}
				prev={showingCover ? cardView : coverView}
				perspective={0.6}
				geometryGroup
				rotationEffect={randomRotation ? entry.rotation : 0}
				animation={{
					type: 'interactiveSpring',
					duration: 0.6,
					value: entry.index,
				}}
			/>
			<FullButton intent={app.shuffle()} />
		</ZStack>
	);
}

function widgetTimeline(): Timeline<ShuffleData> {
	return {
		entries: [{date: new Date(), ...currentState()}],
		update: 'never',
	};
}

const app = Await.define({
	widget,
	widgetTimeline,
	widgetFamilies: ['small', 'medium', 'large'],
	widgetIntents: {shuffle, resetShuffle},
});
