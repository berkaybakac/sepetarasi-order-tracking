import { OrderStatus, getOrderUrgency } from "@sepetarasi/shared";
import type { Order } from "@sepetarasi/shared";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { StatusButton } from "./StatusButton";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
	PREPARING: {
		label: "Hazırlanıyor",
		className: "bg-amber-500/20 text-amber-400 ring-1 ring-inset ring-amber-500/30",
	},
	READY: {
		label: "Hazır",
		className: "bg-emerald-500/20 text-emerald-400 ring-1 ring-inset ring-emerald-500/30",
	},
	DELIVERED: { label: "Teslim", className: "bg-sky-500/20 text-sky-400" },
	CANCELLED: { label: "İptal", className: "bg-red-500/20 text-red-400" },
};

// Very subtle status-aware tint in card background gradient
const STATUS_CARD_FROM: Record<string, string> = {
	PREPARING: "from-amber-500/[0.04]",
	READY: "from-emerald-500/[0.05]",
	DELIVERED: "from-sky-500/[0.03]",
	CANCELLED: "from-red-500/[0.03]",
};

function formatElapsed(mins: number): string {
	if (mins < 1) return "az önce";
	if (mins < 60) return `${mins} dk`;
	return `${Math.floor(mins / 60)} sa ${mins % 60} dk`;
}

function formatDisplayNo(n: number): string {
	return String(n).padStart(4, "0");
}

function elapsedMins(dateStr: string): number {
	return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

interface OrderCardProps {
	order: Order;
}

export function OrderCard({ order }: OrderCardProps) {
	const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.PREPARING;
	const cardFrom = STATUS_CARD_FROM[order.status] ?? "from-transparent";
	const isTerminal = order.status === "DELIVERED" || order.status === "CANCELLED";
	const [isNoteExpanded, setIsNoteExpanded] = useState(false);

	const targetMinutes = useSettingsStore((s) => s.deliveryTargetMinutes);

	// Track elapsed minutes — update every 30s so warning/overdue state reacts promptly.
	const [mins, setMins] = useState(() => elapsedMins(order.created_at));
	useEffect(() => {
		const id = setInterval(() => setMins(elapsedMins(order.created_at)), 30_000);
		return () => clearInterval(id);
	}, [order.created_at]);

	// Shared helper: hedef - 2dk → warning, hedef aşıldı → overdue.
	const urgency = !isTerminal ? getOrderUrgency(mins, targetMinutes) : "normal";
	const isWarning = urgency === "warning";
	const isCritical = urgency === "overdue";

	// Left border color — urgency overrides status color for active orders
	const borderColor = isCritical
		? "border-l-red-500"
		: isWarning
			? "border-l-amber-400"
			: order.status === "PREPARING"
				? "border-l-amber-500"
				: order.status === "READY"
					? "border-l-emerald-500"
					: order.status === "DELIVERED"
						? "border-l-sky-500"
						: "border-l-red-700";

	// CSS animation class for the pulsing glow (box-shadow, no Framer Motion conflict)
	const urgencyClass = isCritical
		? "[animation:pulse-critical_1.2s_ease-in-out_infinite]"
		: isWarning
			? "[animation:pulse-warn_2s_ease-in-out_infinite]"
			: "";

	// Elapsed display styling based on urgency
	const elapsedClass = isCritical
		? "text-xs font-bold text-red-400"
		: isWarning
			? "text-xs font-semibold text-amber-400"
			: "text-xs text-slate-400";

	return (
		<motion.div
			data-testid="order-card-root"
			layout
			initial={{ opacity: 0, scale: 0.95, y: 16 }}
			animate={{ opacity: isTerminal ? 0.4 : 1, scale: 1, y: 0 }}
			exit={{ opacity: 0, scale: 0.9, x: -20 }}
			transition={{ type: "spring", stiffness: 350, damping: 30 }}
			className={`h-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.07] border-l-4 bg-gradient-to-br ${cardFrom} to-slate-900 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-xl hover:shadow-black/40 ${borderColor} ${urgencyClass}`}
		>
			<div data-testid="order-card-content" className="flex h-full min-h-0 flex-col p-4">
				{/* Top: order number + status badge + elapsed */}
				<div className="flex items-start justify-between gap-3 mb-3 min-w-0">
					<span className="text-4xl font-black tabular-nums leading-none bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent shrink-0">
						#{formatDisplayNo(order.display_no)}
					</span>
					<div className="flex flex-col items-end gap-1.5 shrink-0">
						<span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.className}`}>
							{badge.label}
						</span>
						<span className={elapsedClass}>
							{isCritical ? `⚠ ${formatElapsed(mins)}` : formatElapsed(mins)}
						</span>
					</div>
				</div>

				{/* Customer info */}
				<div className="mb-3 min-w-0">
					<p className="text-lg font-bold text-white leading-snug break-words [overflow-wrap:anywhere] [word-break:break-word]">
						{order.customer_name ?? "İsimsiz"}
					</p>
					<span className="inline-block mt-1 bg-slate-700/60 text-slate-300 text-xs px-2.5 py-0.5 rounded-full font-medium">
						{order.order_type ?? "—"}
					</span>
				</div>

				{/* Notes */}
				{order.notes && (
					<div className="mb-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-lg px-3 py-2 text-sm min-w-0">
						<p
							data-testid="order-card-note"
							className={`break-words [overflow-wrap:anywhere] [word-break:break-word] ${
								isNoteExpanded
									? "max-h-24 overflow-y-auto pr-1"
									: "overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]"
							}`}
						>
							{order.notes}
						</p>
						{order.notes.length > 120 && (
							<button
								type="button"
								onClick={() => setIsNoteExpanded((v) => !v)}
								className="mt-1 text-xs font-semibold text-amber-200/90 hover:text-amber-100 transition-colors"
							>
								{isNoteExpanded ? "Notu daralt" : "Notun tamamını göster"}
							</button>
						)}
					</div>
				)}

				{/* Actions */}
				{!isTerminal && (
					<div data-testid="order-card-actions" className="mt-auto space-y-2 pt-3">
						<StatusButton order={order} targetStatus={OrderStatus.READY} size="lg" />
						<StatusButton order={order} targetStatus={OrderStatus.DELIVERED} size="lg" />
						<div className="flex gap-2">
							<StatusButton order={order} targetStatus={OrderStatus.PREPARING} size="sm" />
							<StatusButton
								order={order}
								targetStatus={OrderStatus.CANCELLED}
								size="sm"
								requireConfirm
							/>
						</div>
					</div>
				)}
			</div>
		</motion.div>
	);
}
