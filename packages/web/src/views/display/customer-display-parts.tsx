import type { Order } from "@sepetarasi/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { READY_HIGHLIGHT_ANIMATION_SECONDS } from "./display-config";

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

export function useDisplayViewport() {
	const [viewport, setViewport] = useState(() => ({
		width: window.innerWidth,
		height: window.innerHeight,
	}));

	useEffect(() => {
		const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	return viewport;
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
	containerClass,
	railClass,
	titleSizeClass,
	titleClass,
	kpiCardSizeClass,
	kpiCardClass,
	kpiNumberClass,
}: {
	title: string;
	count: number;
	containerClass: string;
	railClass: string;
	titleSizeClass: string;
	titleClass: string;
	kpiCardSizeClass: string;
	kpiCardClass: string;
	kpiNumberClass: string;
}) {
	return (
		<div className={`flex items-center justify-between ${containerClass} ${railClass}`}>
			<h2
				className={`${titleSizeClass} font-bold ${titleClass} tracking-[0.02em] leading-[1] -translate-y-[0.03em] min-w-0`}
			>
				{title}
			</h2>
			<div
				className={`shrink-0 inline-flex items-center justify-center rounded-[clamp(0.65rem,1.45vmin,0.85rem)] shadow-lg shadow-black/20 ${kpiCardSizeClass} ${kpiCardClass}`}
			>
				<span className={`font-extrabold tabular-nums leading-none ${kpiNumberClass}`}>
					{count}
				</span>
			</div>
		</div>
	);
}

export function getOrderNumberCompactClass(displayNo: number): string {
	const digitCount = String(Math.abs(displayNo)).length;
	if (digitCount >= 4) return "text-[0.64em] tracking-[-0.07em]";
	if (digitCount >= 3) return "text-[0.82em] tracking-[-0.045em]";
	return "";
}

export function getOrderBadgeSizeClass(displayNo: number): string {
	const digitCount = String(Math.abs(displayNo)).length;
	if (digitCount >= 4) return "w-[2.02em]";
	if (digitCount >= 3) return "w-[1.86em]";
	return "w-[1.62em]";
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
	const compactNumberClass = getOrderNumberCompactClass(displayNo);
	const badgeSizeClass = getOrderBadgeSizeClass(displayNo);

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
			className={`aspect-square ${badgeSizeClass} max-w-full mx-auto rounded-full flex items-center justify-center font-bold tabular-nums ${textClass} ${highlight ? highlightClass : badgeClass}`}
		>
			<span className={`leading-none ${compactNumberClass}`}>{displayNo}</span>
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
	headerContainerClass: string;
	ordersGridClass: string;
	emptyTextLayoutClass: string;
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
	headerContainerClass,
	ordersGridClass,
	emptyTextLayoutClass,
}: OrdersColumnProps) {
	return (
		<div className={containerClass}>
			<ColumnKpiHeader
				title={title}
				count={count}
				containerClass={headerContainerClass}
				railClass={railClass}
				titleSizeClass={titleSizeClass}
				titleClass={titleClass}
				kpiCardSizeClass={kpiCardSizeClass}
				kpiCardClass={kpiCardClass}
				kpiNumberClass={kpiNumberClass}
			/>
			<div className={ordersGridClass}>
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
				<p className={`text-center ${emptyTextLayoutClass} ${emptyTextClass}`}>{emptyText}</p>
			)}
		</div>
	);
}
