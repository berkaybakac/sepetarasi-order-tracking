import type { DeliveryAnalyticsResult } from "@sepetarasi/shared";
import { useMemo } from "react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { StatsEmptyState } from "./StatsPanels";
import { formatBucket } from "./range-utils";

interface Props {
	analytics: DeliveryAnalyticsResult | null;
	targetMinutes: number;
	empty: boolean;
}

function renderTargetLabel({
	viewBox,
}: {
	viewBox?: { x?: number; y?: number; width?: number };
}) {
	if (viewBox?.x == null || viewBox.y == null || viewBox.width == null) {
		return null;
	}

	const labelWidth = 52;
	const labelHeight = 22;
	const labelX = viewBox.x + viewBox.width - labelWidth - 10;
	const labelY = viewBox.y < 28 ? viewBox.y + 8 : viewBox.y - labelHeight - 8;

	return (
		<g>
			<rect
				x={labelX}
				y={labelY}
				width={labelWidth}
				height={labelHeight}
				rx={11}
				fill="#08111f"
				stroke="#facc15"
				strokeOpacity={0.35}
			/>
			<text
				x={labelX + labelWidth / 2}
				y={labelY + labelHeight / 2}
				fill="#facc15"
				fontSize={11}
				fontWeight={600}
				textAnchor="middle"
				dominantBaseline="central"
			>
				Hedef
			</text>
		</g>
	);
}

export function PeriodStatsTimeSeries({ analytics, targetMinutes, empty }: Props) {
	const chartData = useMemo(() => {
		if (!analytics) return [];
		return analytics.timeSeries.points.map((p) => ({
			label: formatBucket(p.bucket, analytics.timeSeries.granularity),
			dk: p.averageDeliveryMinutes,
			count: p.deliveredCount,
		}));
	}, [analytics]);

	return (
		<div className="rounded-[1.45rem] border border-border-subtle bg-surface-1/85 p-4">
			<div className="mb-3 flex items-center justify-between">
				<h3 className="text-sm font-semibold text-text-strong">
					{analytics?.timeSeries.granularity === "hour"
						? "Saatlik Teslim Süresi"
						: "Günlük Teslim Süresi"}
				</h3>
				{analytics ? (
					<span className="text-xs text-text-subtle">{targetMinutes} dk hedef</span>
				) : null}
			</div>
			{empty || chartData.length === 0 ? (
				<StatsEmptyState label="Bu aralıkta teslim edilen sipariş yok" />
			) : (
				<ResponsiveContainer width="100%" height={260}>
					<LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
						<CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
						<XAxis dataKey="label" stroke="#64748b" fontSize={12} />
						<YAxis stroke="#64748b" fontSize={12} unit=" dk" />
						<Tooltip
							contentStyle={{
								background: "rgba(15,23,42,0.95)",
								border: "1px solid rgba(255,255,255,0.1)",
								borderRadius: 8,
							}}
							labelStyle={{ color: "#e2e8f0" }}
							formatter={(value, name) =>
								name === "dk"
									? [`${String(value)} dk`, "Ortalama"]
									: [`${String(value)}`, "Teslimat"]
							}
						/>
						<ReferenceLine
							y={targetMinutes}
							stroke="#facc15"
							strokeDasharray="4 4"
							label={renderTargetLabel}
						/>
						<Line
							type="monotone"
							dataKey="dk"
							stroke="#38bdf8"
							strokeWidth={2.5}
							dot={{ r: 4, fill: "#38bdf8" }}
							activeDot={{ r: 6 }}
						/>
					</LineChart>
				</ResponsiveContainer>
			)}
		</div>
	);
}
