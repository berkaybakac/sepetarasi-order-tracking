import { NotePresetsCard } from "../NotePresetsCard";
import { PageIntro } from "../ui/PageIntro";

export function NotePresetsTab() {
	return (
		<div className="space-y-6">
			<PageIntro eyebrow="Kasa Hızı" title="Hazır Notlar" />
			<div className="grid grid-cols-1 gap-4">
				<NotePresetsCard />
			</div>
		</div>
	);
}
