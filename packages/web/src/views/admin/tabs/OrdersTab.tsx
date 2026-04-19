import { useEffect, useState } from "react";
import { useOrderStore } from "../../../stores/orderStore";
import { OrderColumns, StatCards } from "../OrderColumns";
import { PageIntro } from "../ui/PageIntro";
import { SectionCard, SkeletonBlock } from "../ui/primitives";

const METRIC_SKELETON_IDS = ["metric-orders", "metric-revenue", "metric-timing"];
const COLUMN_SKELETONS = [
	{ id: "column-new", cardIds: ["card-new-a", "card-new-b"] },
	{ id: "column-preparing", cardIds: ["card-preparing-a", "card-preparing-b"] },
	{ id: "column-ready", cardIds: ["card-ready-a", "card-ready-b"] },
];

function OrdersTabSkeleton() {
	return (
		<div className="space-y-6" data-orders-tab-state="loading">
			<PageIntro eyebrow="Operasyon" title="Canlı Sipariş Akışı" />
			<div className="grid gap-4 md:grid-cols-3">
				{METRIC_SKELETON_IDS.map((id) => (
					<SkeletonBlock key={id} className="h-[8.75rem] rounded-panel" />
				))}
			</div>
			<SectionCard title="Sipariş Panosu">
				<div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
					{COLUMN_SKELETONS.map((column) => (
						<div
							key={column.id}
							className="rounded-[1.25rem] border border-border-subtle bg-surface-3/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
						>
							<div className="mb-4 flex items-center justify-between gap-2">
								<SkeletonBlock className="h-4 w-28" />
								<SkeletonBlock className="h-6 w-10 rounded-full" />
							</div>
							<div className="space-y-3">
								{column.cardIds.map((cardId) => (
									<SkeletonBlock key={cardId} className="h-28 rounded-[1.1rem]" />
								))}
							</div>
						</div>
					))}
				</div>
			</SectionCard>
		</div>
	);
}

export function OrdersTab() {
	const initialLoadSettled = useOrderStore((s) => s.initialLoadSettled);
	const [allowEntryAnimations, setAllowEntryAnimations] = useState(false);

	useEffect(() => {
		if (!initialLoadSettled) {
			setAllowEntryAnimations(false);
			return undefined;
		}

		const frameId = window.requestAnimationFrame(() => {
			setAllowEntryAnimations(true);
		});

		return () => {
			window.cancelAnimationFrame(frameId);
		};
	}, [initialLoadSettled]);

	if (!initialLoadSettled) {
		return <OrdersTabSkeleton />;
	}

	return (
		<div className="space-y-6">
			<PageIntro eyebrow="Operasyon" title="Canlı Sipariş Akışı" />
			<StatCards />
			<OrderColumns animateEntries={allowEntryAnimations} />
		</div>
	);
}
