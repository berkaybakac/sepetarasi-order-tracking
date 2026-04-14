import type { Order } from "@sepetarasi/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
	READY_HIGHLIGHT_ANIMATION_SECONDS,
	resolveLayoutMode,
	type DisplayConfig,
} from "./display-config";

export function useVisibleReadyOrders(readyOrders: Order[], readyDisplayMinutes: number): Order[] {
	return useMemo(() => {
		const now = Date.now();
		const durationMs = readyDisplayMinutes * 60 * 1000;
		return readyOrders.filter((order) => {
			if (!order.ready_at) return true;
			return now - new Date(order.ready_at).getTime() < durationMs;
		});
	}, [readyOrders, readyDisplayMinutes]);
}

export function useDisplayLayoutMode(
	profile: DisplayConfig["profile"],
	layoutPreference: DisplayConfig["layoutPreference"],
) {
	const [viewport, setViewport] = useState(() => ({
		width: window.innerWidth,
		height: window.innerHeight,
	}));

	useEffect(() => {
		const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	return useMemo(
		() => resolveLayoutMode(viewport.width, viewport.height, { profile, layoutPreference }),
		[layoutPreference, profile, viewport.height, viewport.width],
	);
}

export function ClockText({ className }: { className: string }) {
	const [time, setTime] = useState(() => new Date());
	useEffect(() => {
		const id = setInterval(() => setTime(new Date()), 1000);
		return () => clearInterval(id);
	}, []);
	return (
		<span className={className}>
			{time.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", hour12: false })}
		</span>
	);
}

export function ColumnKpiHeader({
	title,
	count,
	railClass,
	titleSizeClass,
	titleClass,
	kpiCardSizeClass,
	kpiCardClass,
	kpiNumberClass,
}: {
	title: string;
	count: number;
	railClass: string;
	titleSizeClass: string;
	titleClass: string;
	kpiCardSizeClass: string;
	kpiCardClass: string;
	kpiNumberClass: string;
}) {
	return (
		<div
			className={`mb-[clamp(0.5rem,2.2vmin,1.6rem)] h-[clamp(5.5rem,11vmin,6.5rem)] rounded-[clamp(0.45rem,1.15vmin,0.7rem)] px-[clamp(0.7rem,2.2vmin,1.5rem)] py-[clamp(0.45rem,1.2vmin,0.85rem)] flex items-center justify-between gap-[clamp(0.75rem,2.5vmin,1.75rem)] ${railClass}`}
		>
			<h2
				className={`${titleSizeClass} font-bold ${titleClass} tracking-[0.02em] leading-[1] -translate-y-[0.03em] min-w-0`}
			>
				{title}
			</h2>
			<div
				className={`shrink-0 inline-flex items-center justify-center rounded-[clamp(0.65rem,1.45vmin,0.85rem)] shadow-lg shadow-black/20 ${kpiCardSizeClass} ${kpiCardClass}`}
			>
				<span className={`font-extrabold tabular-nums leading-none ${kpiNumberClass}`}>{count}</span>
			</div>
		</div>
	);
}

export function OrderNumber({
	displayNo,
	highlight,
	textClass,
	badgeClass,
	highlightClass,
}: {
	displayNo: number;
	highlight?: boolean;
	textClass: string;
	badgeClass: string;
	highlightClass: string;
}) {
	return (
		<motion.div
			layout
			layoutId={`order-${displayNo}`}
			// Assumes `nowPlaying` transitions true -> false between announcements.
			// If future WS flow can emit repeated true for the same order without reset,
			// switch to imperative controls.start() to force re-trigger.
			animate={
				highlight
					? {
							opacity: 1,
							y: 0,
							scale: [1, 1.45, 1.1, 1.0],
							transition: {
								duration: READY_HIGHLIGHT_ANIMATION_SECONDS,
								ease: "easeInOut",
							},
						}
					: { opacity: 1, y: 0, scale: 1 }
			}
			initial={{ opacity: 0, scale: 0.75, y: 24 }}
			exit={{ opacity: 0, scale: 0.6, y: -16, transition: { duration: 0.2 } }}
			transition={{ type: "spring", stiffness: 300, damping: 25 }}
			className={`aspect-square max-w-[clamp(3rem,16vmin,9rem)] w-full mx-auto rounded-full flex items-center justify-center font-bold tabular-nums ${textClass} ${highlight ? highlightClass : badgeClass}`}
		>
			{displayNo}
		</motion.div>
	);
}

interface OrdersColumnProps {
	containerClass: string;
	title: string;
	count: number;
	railClass: string;
	titleSizeClass: string;
	titleClass: string;
	kpiCardSizeClass: string;
	kpiCardClass: string;
	kpiNumberClass: string;
	orders: Order[];
	orderTextClass: string;
	badgeClass: string;
	highlightClass: string;
	highlightOrderId?: string;
	emptyText: string;
	emptyTextClass: string;
}

export function OrdersColumn({
	containerClass,
	title,
	count,
	railClass,
	titleSizeClass,
	titleClass,
	kpiCardSizeClass,
	kpiCardClass,
	kpiNumberClass,
	orders,
	orderTextClass,
	badgeClass,
	highlightClass,
	highlightOrderId,
	emptyText,
	emptyTextClass,
}: OrdersColumnProps) {
	return (
		<div className={containerClass}>
			<ColumnKpiHeader
				title={title}
				count={count}
				railClass={railClass}
				titleSizeClass={titleSizeClass}
				titleClass={titleClass}
				kpiCardSizeClass={kpiCardSizeClass}
				kpiCardClass={kpiCardClass}
				kpiNumberClass={kpiNumberClass}
			/>
			<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[clamp(0.125rem,1vmin,1rem)] overflow-hidden">
				<AnimatePresence mode="popLayout">
					{orders.map((order) => (
						<OrderNumber
							key={order.id}
							displayNo={order.display_no}
							highlight={highlightOrderId === order.id}
							textClass={orderTextClass}
							badgeClass={badgeClass}
							highlightClass={highlightClass}
						/>
					))}
				</AnimatePresence>
			</div>
			{orders.length === 0 && (
				<p className={`text-center text-[clamp(1rem,3vmin,1.5rem)] mt-[clamp(0.5rem,4vmin,3rem)] ${emptyTextClass}`}>
					{emptyText}
				</p>
			)}
		</div>
	);
}
