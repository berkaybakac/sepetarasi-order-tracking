import { PeriodStats } from "../PeriodStats";

interface Props {
	wsTrigger: number;
	reconnectedAt: number;
}

export function StatsTab({ wsTrigger, reconnectedAt }: Props) {
	return (
		<div className="max-w-2xl">
			<PeriodStats wsTrigger={wsTrigger} reconnectedAt={reconnectedAt} />
		</div>
	);
}
