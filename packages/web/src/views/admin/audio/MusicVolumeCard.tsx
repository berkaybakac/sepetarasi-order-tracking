import { SETTING_KEYS } from "@sepetarasi/shared";
import { UI_LABELS } from "../../../constants/labels";
import { api } from "../../../lib/api";
import { VolumeControlCard } from "./VolumeControlCard";

const ICON = (
	<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
		<title>müzik sesi ikonu</title>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
		/>
	</svg>
);

async function fetchVolumeAndEnabled() {
	const s = await api.getSettings();
	return {
		volume: Number(s[SETTING_KEYS.MUSIC_VOLUME] ?? 60),
		enabled: s[SETTING_KEYS.MUSIC_ENABLED] === "1",
	};
}

export function MusicVolumeCard() {
	return (
		<VolumeControlCard
			title={UI_LABELS.AUDIO.MUSIC_VOLUME}
			icon={ICON}
			helperText={UI_LABELS.AUDIO.MUSIC_HELP}
			defaultVolume={60}
			colorScheme="purple"
			onMount={fetchVolumeAndEnabled}
			onSave={(volume) => api.setMusicVolume(volume)}
			enabledToggle={{
				enabledLabel: UI_LABELS.AUDIO.MUSIC_ENABLED,
				disabledLabel: UI_LABELS.AUDIO.MUSIC_DISABLED,
				onToggle: (next) => api.setMusicEnabled(next),
			}}
		/>
	);
}
