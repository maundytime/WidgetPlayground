import {Text, VStack} from 'await';

type EntryData = {
	altitudeMeters?: number;
};

function widget({size, altitudeMeters}: WidgetEntry<EntryData>) {
	return (
		<VStack spacing={8} padding={20} frame={size} background='#F5F5F0' foreground='#26352B'>
			<Text value='当前海拔' fontSize={13}/>
			<Text
				value={altitudeMeters?.toFixed(0)}
				fontSize={54}
				fontWeight='medium'
				monospacedDigit
				lineLimit={1}
				minimumScaleFactor={0.4}
			/>
			<Text value='米' fontSize={13}/>
		</VStack>
	);
}

async function widgetTimeline(): Promise<Timeline<EntryData>> {
	const location = await AwaitLocation.get();
	return {
		entries: [{date: new Date(), altitudeMeters: location?.altitudeMeters}],
		update: 'rapid',
	};
}

Await.define({widget, widgetTimeline, widgetFamilies: ['small']});
