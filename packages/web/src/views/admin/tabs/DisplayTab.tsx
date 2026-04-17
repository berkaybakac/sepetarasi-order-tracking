import { DisplaySettingsCard } from "../DisplaySettingsCard";
import { PageIntro } from "../ui/PageIntro";

export function DisplayTab() {
	return (
		<div className="space-y-6">
			<PageIntro
				eyebrow="Müşteri Ekranı"
				title="Vitrin Deneyimini Ayarla"
				description="Müşterinin gördüğü ekranın bilgi yoğunluğunu, sayfalama hızını ve tema karakterini satış deneyimine göre düzenleyin."
			/>
			<div className="max-w-4xl">
				<DisplaySettingsCard />
			</div>
		</div>
	);
}
