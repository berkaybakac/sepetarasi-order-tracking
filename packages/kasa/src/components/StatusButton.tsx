import { OrderStatus, STATUS_TRANSITIONS } from "@sepetarasi/shared";
import type { Order } from "@sepetarasi/shared";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { reportRendererError } from "../lib/electron";
import { useOrderStore } from "../stores/orderStore";

const STATUS_CONFIG: Record<OrderStatus, { label: string; lgClass: string; smClass: string }> = {
	[OrderStatus.PREPARING]: {
		label: "Geri Al",
		lgClass:
			"w-full py-5 text-lg font-bold rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 transition-all duration-150 active:scale-[0.98] active:bg-slate-600",
		smClass:
			"flex-1 py-4 text-sm font-semibold rounded-lg border border-slate-500 text-slate-300 hover:text-white hover:border-slate-400 hover:bg-slate-700/50 transition-all duration-150 active:scale-95 active:bg-slate-700",
	},
	[OrderStatus.READY]: {
		label: "Hazır",
		lgClass:
			"w-full py-5 text-lg font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:from-emerald-600 active:to-teal-600 text-white shadow-[0_0_24px_rgba(16,185,129,0.30)] hover:shadow-[0_0_32px_rgba(16,185,129,0.45)] transition-all duration-150 active:scale-[0.98]",
		smClass:
			"flex-1 py-3 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-all duration-150 active:scale-95",
	},
	[OrderStatus.DELIVERED]: {
		label: "Teslim Et",
		lgClass:
			"w-full py-5 text-lg font-bold rounded-xl bg-gradient-to-r from-sky-400 to-blue-600 hover:from-sky-300 hover:to-blue-500 active:from-sky-500 active:to-blue-700 text-white shadow-[0_0_24px_rgba(14,165,233,0.30)] hover:shadow-[0_0_32px_rgba(14,165,233,0.45)] transition-all duration-150 active:scale-[0.98]",
		smClass:
			"flex-1 py-3 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-all duration-150 active:scale-95",
	},
	[OrderStatus.CANCELLED]: {
		label: "İptal",
		lgClass:
			"w-full py-5 text-lg font-bold rounded-xl border border-red-800 text-red-400 hover:bg-red-500/10 hover:border-red-600 transition-all duration-150 active:scale-[0.98] active:bg-red-500/10",
		smClass:
			"flex-1 py-4 text-sm font-semibold rounded-lg border border-red-800/70 text-red-400 hover:bg-red-500/10 hover:border-red-600 transition-all duration-150 active:scale-95 active:bg-red-500/15",
	},
};

interface StatusButtonProps {
	order: Order;
	targetStatus: OrderStatus;
	size?: "lg" | "sm";
	requireConfirm?: boolean;
}

export function StatusButton({
	order,
	targetStatus,
	size = "lg",
	requireConfirm = false,
}: StatusButtonProps) {
	const [loading, setLoading] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const hydrate = useOrderStore((s) => s.hydrate);

	const currentStatus = order.status as OrderStatus;
	const allowed = STATUS_TRANSITIONS[currentStatus]?.includes(targetStatus) ?? false;

	// Auto-reset confirmation after 3 seconds if user doesn't tap again
	useEffect(() => {
		if (!confirming) return;
		const id = setTimeout(() => setConfirming(false), 3000);
		return () => clearTimeout(id);
	}, [confirming]);

	if (!allowed) return null;

	const config = STATUS_CONFIG[targetStatus];

	const handleClick = async () => {
		if (requireConfirm && !confirming) {
			setConfirming(true);
			return;
		}
		setConfirming(false);
		setLoading(true);
		try {
			await api.changeStatus(order.id, { status: targetStatus });
		} catch (err) {
			reportRendererError({
				component: "status-button",
				event: "orders.status_change_failed",
				message: "Status change failed",
				error: err,
				context: {
					orderId: order.id,
					currentStatus,
					targetStatus,
				},
			});
			await hydrate();
		} finally {
			setLoading(false);
		}
	};

	// Confirmation pending state
	if (confirming) {
		const confirmClass =
			size === "sm"
				? "flex-1 py-3 text-sm font-bold rounded-lg bg-red-500/15 border border-red-500/70 text-red-300 animate-pulse transition-all active:scale-95"
				: "w-full py-5 text-lg font-bold rounded-xl bg-red-500/15 border border-red-500/70 text-red-300 animate-pulse transition-all active:scale-[0.98]";
		return (
			<button type="button" onClick={handleClick} className={confirmClass}>
				Emin misin?
			</button>
		);
	}

	const className = size === "lg" ? config.lgClass : config.smClass;

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={loading}
			className={`${className} disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100`}
		>
			{loading ? "..." : config.label}
		</button>
	);
}
