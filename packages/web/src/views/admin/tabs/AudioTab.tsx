import { AnnouncementVolumeCard } from "../audio/AnnouncementVolumeCard";
import { MusicLibraryCard } from "../audio/MusicLibraryCard";
import { MusicPlayerCard } from "../audio/MusicPlayerCard";
import { MusicVolumeCard } from "../audio/MusicVolumeCard";
import { PageIntro } from "../ui/PageIntro";

export function AudioTab() {
	return (
		<div className="space-y-6">
			<PageIntro
				eyebrow="Anons & Müzik Merkezi"
				title="Anons ve Müzik Davranışı"
				actions={
					<div className="flex flex-wrap gap-2 md:justify-end">
						<span className="rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
							Canlı kontrol
						</span>
						<span className="rounded-full border border-cyan-400/15 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
							Hızlı yükleme
						</span>
						<span className="rounded-full border border-violet-400/15 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
							Toplu düzenleme
						</span>
					</div>
				}
				className="gap-4"
			/>
			<div className="grid gap-6 md:grid-cols-2 md:items-stretch">
				<div className="md:col-span-1">
					<MusicVolumeCard />
				</div>
				<div className="md:col-span-1">
					<AnnouncementVolumeCard />
				</div>
				<div className="md:col-span-2">
					<MusicPlayerCard />
				</div>
				<div className="md:col-span-2">
					<MusicLibraryCard />
				</div>
			</div>
		</div>
	);
}
