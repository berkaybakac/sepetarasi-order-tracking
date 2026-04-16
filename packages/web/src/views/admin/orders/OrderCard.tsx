import { OrderStatus } from "@sepetarasi/shared";
import type { Order } from "@sepetarasi/shared";
import { useEffect, useState } from "react";
import { getDeliveredOrderDurationLabel, getOrderTimer } from "../../../utils/date";

function formatOrderTimestamp(dateStr: string): string {
	return new Intl.DateTimeFormat("tr-TR", {
		timeZone: "Europe/Istanbul",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(new Date(dateStr));
}

/**
 * TimerBadge — PREPARING/READY için canlı, DELIVERED için sabit süre rozetidir.
 */
function TimerBadge({ order, status }: { order: Order; status: OrderStatus }) {
	const isLiveTimer = status === OrderStatus.PREPARING || status === OrderStatus.READY;
	const [, setTick] = useState(0);

	useEffect(() => {
		if (!isLiveTimer) return;
		const id = setInterval(() => setTick((t) => t + 1), 30_000);
		return () => clearInterval(id);
	}, [isLiveTimer]);

	if (status === OrderStatus.DELIVERED) {
		const deliveredDuration = getDeliveredOrderDurationLabel(
			order.created_at,
			order.delivered_at,
			order.updated_at,
		);
		return (
			<span className="text-xs text-dark-muted font-medium tabular-nums">{deliveredDuration}</span>
		);
	}

	const { isUrgent, isOverdue, formatted, remainingMins } = getOrderTimer(order.created_at);

	if (isOverdue) {
		return (
			<span className="inline-flex items-center gap-1 text-xs font-bold text-brand-danger bg-brand-danger/15 border border-brand-danger/40 rounded-full px-2 py-0.5 animate-pulse">
				<svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
				</svg>
				{formatted}
			</span>
		);
	}

	if (isUrgent) {
		return (
			<span className="inline-flex items-center gap-1 text-xs font-bold text-brand-warning bg-brand-warning/15 border border-brand-warning/40 rounded-full px-2 py-0.5 animate-pulse">
				<svg
					className="w-3 h-3"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2.5}
						d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				{formatted}
			</span>
		);
	}

	return (
		<span className="text-xs text-dark-muted font-medium tabular-nums">
			{remainingMins} dk kaldı
		</span>
	);
}

/**
 * Durum bazlı kart stil tanımları — Tek Doğru Kaynak (SSoT).
 * Renk değerleri `global.css` token'larına referans verir.
 */
export const CARD_STYLES: Record<
	OrderStatus,
	{ border: string; urgentBorder: string; overdueBorder: string; glow: string; overdueGlow: string }
> = {
	[OrderStatus.PREPARING]: {
		border: "border-brand-warning/30 hover:border-brand-warning/60",
		urgentBorder: "border-brand-warning/60",
		overdueBorder: "border-brand-danger/60",
		glow: "",
		overdueGlow: "shadow-[0_0_18px_rgba(239,68,68,0.15)]",
	},
	[OrderStatus.READY]: {
		border: "border-brand-success/30 hover:border-brand-success/60",
		urgentBorder: "border-brand-warning/60",
		overdueBorder: "border-brand-danger/60",
		glow: "",
		overdueGlow: "shadow-[0_0_18px_rgba(239,68,68,0.15)]",
	},
	[OrderStatus.DELIVERED]: {
		border: "border-brand-primary/20 hover:border-brand-primary/40",
		urgentBorder: "",
		overdueBorder: "",
		glow: "",
		overdueGlow: "",
	},
	[OrderStatus.CANCELLED]: {
		border: "border-white/10 hover:border-white/20",
		urgentBorder: "",
		overdueBorder: "",
		glow: "",
		overdueGlow: "",
	},
};

/**
 * OrderCard — Tek bir siparişi kart olarak gösterir.
 */
export function OrderCard({ order, status }: { order: Order; status: OrderStatus }) {
	const { isOverdue, isUrgent } =
		status !== OrderStatus.DELIVERED && status !== OrderStatus.CANCELLED
			? getOrderTimer(order.created_at)
			: { isOverdue: false, isUrgent: false };
	const [isNoteExpanded, setIsNoteExpanded] = useState(false);

	const styles = CARD_STYLES[status];

	const borderClass = isOverdue
		? styles.overdueBorder
		: isUrgent
			? styles.urgentBorder
			: styles.border;
	const lineItemCounts = new Map<string, number>();

	return (
		<div
			className={`
				bg-dark-surface backdrop-blur-sm border rounded-2xl p-4 min-w-0
				transition-all duration-300
				hover:bg-white/8 hover:scale-[1.01] hover:shadow-lg
				${borderClass}
				${isOverdue ? styles.overdueGlow : ""}
			`}
		>
			<div className="flex justify-between items-start mb-2 gap-2 min-w-0">
				<span className="text-2xl font-bold text-dark-text tracking-tight">
					#{order.display_no}
				</span>
				<TimerBadge order={order} status={status} />
			</div>

			<div className="space-y-1 text-sm text-dark-muted min-w-0">
				<p className="text-base font-semibold text-dark-text break-words [overflow-wrap:anywhere] [word-break:break-word]">
					{order.customer_name ?? "İsimsiz müşteri"}
				</p>
				<p>Tip: {order.order_type ?? "-"}</p>
				<p>Saat: {formatOrderTimestamp(order.created_at)}</p>
				{order.notes && (
					<div className="italic text-brand-warning min-w-0">
						<p
							className={`break-words [overflow-wrap:anywhere] [word-break:break-word] ${
								isNoteExpanded
									? "max-h-24 overflow-y-auto pr-1"
									: "overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]"
							}`}
						>
							Not: {order.notes}
						</p>
						{order.notes.length > 120 && (
							<button
								type="button"
								onClick={() => setIsNoteExpanded((v) => !v)}
								className="mt-1 not-italic text-[11px] font-semibold text-brand-warning/90 hover:text-brand-warning transition-colors"
							>
								{isNoteExpanded ? "Notu daralt" : "Notun tamamını göster"}
							</button>
						)}
					</div>
				)}
			</div>

			{order.items && order.items.length > 0 && (
				<div className="space-y-1.5 mt-3 pt-3 border-t border-white/5">
					{order.items.map((item) => {
						const baseKey = `${item.name}:${item.quantity}:${item.unit_price}`;
						const nextCount = (lineItemCounts.get(baseKey) ?? 0) + 1;
						lineItemCounts.set(baseKey, nextCount);
						const key = `${order.id}:${baseKey}:${nextCount}`;

						return (
							<div key={key} className="flex items-center gap-2 text-xs text-dark-muted">
								<span className="w-5 h-5 rounded bg-white/5 border border-white/5 flex items-center justify-center text-dark-text font-bold text-[10px] shrink-0">
									{item.quantity}
								</span>
								<span className="truncate">{item.name}</span>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
