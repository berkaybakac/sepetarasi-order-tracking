import { OrderStatus } from "@sepetarasi/shared";
import type { Order } from "@sepetarasi/shared";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { ClockIcon, TagIcon } from "../../../components/icons";
import { useInterval } from "../../../hooks/useInterval";
import { useSettingsStore } from "../../../stores/settingsStore";
import { getDeliveredOrderDurationLabel, getOrderTimer } from "../../../utils/date";

const ORDER_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("tr-TR", {
	timeZone: "Europe/Istanbul",
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	hour12: false,
});

function formatOrderTimestamp(dateStr: string): string {
	return ORDER_TIMESTAMP_FORMATTER.format(new Date(dateStr));
}

type TimerResult = ReturnType<typeof getOrderTimer>;

/**
 * TimerBadge — PREPARING/READY için canlı, DELIVERED için sabit süre rozetidir.
 * timerResult: OrderCard'da hesaplanan timer; border/glow ile aynı render adımından gelir.
 */
function TimerBadge({
	order,
	status,
	timerResult,
}: {
	order: Order;
	status: OrderStatus;
	timerResult: TimerResult | null;
}) {
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

	if (timerResult == null) {
		return null;
	}

	const { isUrgent, isOverdue, formatted, remainingMins } = timerResult;

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
		border: "border-brand-warning/25 hover:border-brand-warning/45",
		urgentBorder: "border-brand-warning/50",
		overdueBorder: "border-brand-danger/55",
		glow: "",
		overdueGlow: "shadow-[0_0_24px_rgba(239,68,68,0.18)]",
	},
	[OrderStatus.READY]: {
		border: "border-brand-success/25 hover:border-brand-success/45",
		urgentBorder: "border-brand-warning/50",
		overdueBorder: "border-brand-danger/55",
		glow: "",
		overdueGlow: "shadow-[0_0_24px_rgba(239,68,68,0.18)]",
	},
	[OrderStatus.DELIVERED]: {
		border: "border-brand-primary/20 hover:border-brand-primary/35",
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
 * tick: OrderColumn'dan 30s'de bir gelen sayaç; border/glow ile rozet aynı render adımında güncellenir.
 */
export function OrderCard({
	order,
	status,
	tick,
	animateEntry = true,
}: { order: Order; status: OrderStatus; tick?: number; animateEntry?: boolean }) {
	const targetMinutes = useSettingsStore((s) => s.deliveryTargetMinutes);
	const isLive = status !== OrderStatus.DELIVERED && status !== OrderStatus.CANCELLED;
	const [, setLocalTick] = useState(0);

	// Parent tick yoksa kartı kendi başına canlı tut ki tekil render/test senaryolarında
	// urgency border ve glow eşik geçişleri güncellenmeye devam etsin.
	useInterval(() => setLocalTick((value) => value + 1), tick == null && isLive ? 30_000 : null);

	const timerResult = isLive ? getOrderTimer(order.created_at, targetMinutes) : null;
	const isOverdue = timerResult?.isOverdue ?? false;
	const isUrgent = timerResult?.isUrgent ?? false;

	const [isNoteExpanded, setIsNoteExpanded] = useState(false);

	const styles = CARD_STYLES[status];

	const borderClass = isOverdue
		? styles.overdueBorder
		: isUrgent
			? styles.urgentBorder
			: styles.border;

	const itemKeys = useMemo(() => {
		const counts = new Map<string, number>();
		return (order.items ?? []).map((item) => {
			const baseKey = `${item.name}:${item.quantity}:${item.unit_price}`;
			const nextCount = (counts.get(baseKey) ?? 0) + 1;
			counts.set(baseKey, nextCount);
			return `${order.id}:${baseKey}:${nextCount}`;
		});
	}, [order.id, order.items]);

	const orderType = order.order_type ?? "Bilinmiyor";
	const orderTimestamp = formatOrderTimestamp(order.created_at);

	return (
		<motion.article
			layout
			initial={animateEntry ? { opacity: 0, y: 12, scale: 0.985 } : false}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, y: -8, scale: 0.985 }}
			transition={{ duration: 0.22, ease: "easeOut" }}
			className={`
				min-w-0 rounded-[1.25rem] border bg-surface-2/95 p-4
				transition-all duration-300
				hover:bg-white/8 hover:shadow-[0_20px_36px_rgba(2,6,23,0.22)]
				${borderClass}
				${isOverdue ? styles.overdueGlow : ""}
			`}
		>
			<div className="mb-3 flex min-w-0 items-start justify-between gap-3">
				<div>
					<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-subtle">
						Sipariş
					</p>
					<span className="text-2xl font-bold tracking-tight text-text-strong">
						#{order.display_no}
					</span>
				</div>
				<TimerBadge order={order} status={status} timerResult={timerResult} />
			</div>

			<div className="min-w-0 space-y-3 text-sm text-text-subtle">
				<p className="break-words text-base font-semibold text-text-strong [overflow-wrap:anywhere] [word-break:break-word]">
					{order.customer_name ?? "İsimsiz müşteri"}
				</p>
				<div className="flex flex-wrap gap-2">
					<span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-white/[0.04] px-2.5 py-1 text-xs text-text-muted">
						<TagIcon className="h-3.5 w-3.5" />
						{orderType}
					</span>
					<span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-white/[0.04] px-2.5 py-1 text-xs text-text-muted">
						<ClockIcon className="h-3.5 w-3.5" />
						{orderTimestamp}
					</span>
				</div>
				{order.notes && (
					<div className="min-w-0 rounded-[1rem] border border-brand-warning/15 bg-brand-warning/8 p-3 text-brand-warning">
						<p
							className={`break-words text-sm [overflow-wrap:anywhere] [word-break:break-word] ${
								isNoteExpanded
									? "max-h-24 overflow-y-auto pr-1"
									: "overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]"
							}`}
						>
							<span className="font-semibold not-italic">Not:</span> {order.notes}
						</p>
						{order.notes.length > 120 && (
							<button
								type="button"
								onClick={() => setIsNoteExpanded((v) => !v)}
								className="mt-2 text-[11px] font-semibold text-brand-warning/90 transition-colors hover:text-brand-warning"
							>
								{isNoteExpanded ? "Notu daralt" : "Notun tamamını göster"}
							</button>
						)}
					</div>
				)}
			</div>

			{order.items && order.items.length > 0 && (
				<div className="mt-4 space-y-2 border-t border-border-subtle pt-4">
					{order.items.map((item, index) => (
						<div key={itemKeys[index]} className="flex items-center gap-2 text-xs text-text-subtle">
							<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/6 border border-border-subtle text-[10px] font-bold text-text-strong">
								{item.quantity}
							</span>
							<span className="truncate">{item.name}</span>
						</div>
					))}
				</div>
			)}
		</motion.article>
	);
}
