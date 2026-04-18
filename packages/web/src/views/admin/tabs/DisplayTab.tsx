import { DisplaySettingsCard } from "../DisplaySettingsCard";
import { PageIntro } from "../ui/PageIntro";

export function DisplayTab() {
	return (
		<div className="space-y-4">
			<PageIntro eyebrow="Müşteri Ekranı" title="Vitrin Deneyimini Ayarla" />
			<div className="max-w-6xl">
				<DisplaySettingsCard />
			</div>
		</div>
	);
}
