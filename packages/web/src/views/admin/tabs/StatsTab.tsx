import { PeriodStats } from "../PeriodStats";
import { PageIntro } from "../ui/PageIntro";

interface Props {
	active?: boolean;
	wsTrigger: number;
	reconnectedAt: number;
}

export function StatsTab({ active = true, wsTrigger, reconnectedAt }: Props) {
	return (
		<div className="space-y-6">
			<PageIntro eyebrow="Analitik" title="Teslimat Performansı" />
			<PeriodStats active={active} wsTrigger={wsTrigger} reconnectedAt={reconnectedAt} />
		</div>
	);
}
