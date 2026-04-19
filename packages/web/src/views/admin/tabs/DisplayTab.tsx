import { DisplaySettingsCard } from "../DisplaySettingsCard";
import { PageIntro } from "../ui/PageIntro";

export function DisplayTab() {
	return (
		<div className="space-y-6">
			<PageIntro eyebrow="Müşteri Ekranı" title="Vitrin Deneyimini Ayarla" />
			<DisplaySettingsCard />
		</div>
	);
}
