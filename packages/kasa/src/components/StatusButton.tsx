import { useState } from "react";
import { OrderStatus, STATUS_TRANSITIONS } from "@sepetarasi/shared";
import type { Order } from "@sepetarasi/shared";
import { api } from "../lib/api";
import { useOrderStore } from "../stores/orderStore";

const STATUS_CONFIG: Record<
	OrderStatus,
	{ label: string; color: string; hoverColor: string }
> = {
	[OrderStatus.PREPARING]: {
		label: "Hazırlanıyor",
		color: "bg-yellow-500",
		hoverColor: "hover:bg-yellow-600",
	},
	[OrderStatus.READY]: {
		label: "Hazır",
		color: "bg-green-500",
		hoverColor: "hover:bg-green-600",
	},
	[OrderStatus.DELIVERED]: {
		label: "Teslim",
		color: "bg-blue-500",
		hoverColor: "hover:bg-blue-600",
	},
	[OrderStatus.CANCELLED]: {
		label: "İptal",
		color: "bg-red-500",
		hoverColor: "hover:bg-red-600",
	},
};

interface StatusButtonProps {
	order: Order;
	targetStatus: OrderStatus;
}

export function StatusButton({ order, targetStatus }: StatusButtonProps) {
	const [loading, setLoading] = useState(false);
	const hydrate = useOrderStore((s) => s.hydrate);

	const currentStatus = order.status as OrderStatus;
	const allowed = STATUS_TRANSITIONS[currentStatus]?.includes(targetStatus) ?? false;

	if (!allowed) return null;

	const config = STATUS_CONFIG[targetStatus];

	const handleClick = async () => {
		setLoading(true);
		try {
			await api.changeStatus(order.id, { status: targetStatus });
		} catch (err) {
			console.error("Status change failed:", err);
			await hydrate();
		} finally {
			setLoading(false);
		}
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={loading}
			className={`${config.color} ${config.hoverColor} text-white font-bold py-3 px-6 rounded-lg text-lg
				disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[120px]`}
		>
			{loading ? "..." : config.label}
		</button>
	);
}
