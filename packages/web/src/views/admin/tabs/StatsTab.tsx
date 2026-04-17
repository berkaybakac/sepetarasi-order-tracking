import { PeriodStats } from "../PeriodStats";

interface Props {
	wsTrigger: number;
	reconnectedAt: number;
}

export function StatsTab({ wsTrigger, reconnectedAt }: Props) {
	return (
		<div className="w-full">
			<PeriodStats wsTrigger={wsTrigger} reconnectedAt={reconnectedAt} />
		</div>
	);
}
