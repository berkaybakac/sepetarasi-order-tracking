import { AnnouncementVolumeCard } from "../audio/AnnouncementVolumeCard";
import { MusicLibraryCard } from "../audio/MusicLibraryCard";
import { MusicPlayerCard } from "../audio/MusicPlayerCard";
import { MusicVolumeCard } from "../audio/MusicVolumeCard";

export function AudioTab() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
			<AnnouncementVolumeCard />
			<MusicVolumeCard />
			<MusicPlayerCard />
			<MusicLibraryCard />
		</div>
	);
}
