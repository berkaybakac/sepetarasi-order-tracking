import { SETTING_KEYS } from "@sepetarasi/shared";
import { UI_LABELS } from "../../../constants/labels";
import { api } from "../../../lib/api";
import { VolumeControlCard } from "./VolumeControlCard";

const ICON = (
	<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
		<title>anons sesi ikonu</title>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
		/>
	</svg>
);

async function fetchVolume() {
	const s = await api.getSettings();
	return { volume: Number(s[SETTING_KEYS.AUDIO_VOLUME] ?? 100) };
}

export function AnnouncementVolumeCard() {
	return (
		<VolumeControlCard
			title={UI_LABELS.AUDIO.ANNOUNCEMENT_VOLUME}
			icon={ICON}
			defaultVolume={100}
			colorScheme="blue"
			onMount={fetchVolume}
			onSave={(volume) => api.updateSetting(SETTING_KEYS.AUDIO_VOLUME, String(volume))}
		/>
	);
}
