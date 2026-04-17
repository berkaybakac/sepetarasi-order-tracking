import { PeriodStats } from "../PeriodStats";
import { PageIntro } from "../ui/PageIntro";

interface Props {
	wsTrigger: number;
	reconnectedAt: number;
}

export function StatsTab({ wsTrigger, reconnectedAt }: Props) {
	return (
		<div className="space-y-6">
			<PageIntro eyebrow="Analitik" title="Teslimat Performansı" />
			<PeriodStats wsTrigger={wsTrigger} reconnectedAt={reconnectedAt} />
		</div>
	);
}
