import { AnnouncementVolumeCard } from "../audio/AnnouncementVolumeCard";
import { MusicLibraryCard } from "../audio/MusicLibraryCard";
import { MusicPlayerCard } from "../audio/MusicPlayerCard";
import { MusicVolumeCard } from "../audio/MusicVolumeCard";
import { PageIntro } from "../ui/PageIntro";

export function AudioTab() {
	return (
		<div className="space-y-6">
			<PageIntro
				eyebrow="Anons Merkezi"
				title="Anons ve Müzik Davranışı"
				description="Anons seviyesini, müzik akışını ve parça arşivini tek yerden yönetin. Değişiklikler mağaza akışına anında yansır."
			/>
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
				<AnnouncementVolumeCard />
				<MusicVolumeCard />
				<MusicPlayerCard />
				<MusicLibraryCard />
			</div>
		</div>
	);
}
