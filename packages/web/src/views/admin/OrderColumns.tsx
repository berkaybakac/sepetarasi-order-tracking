/**
 * OrderColumns — Orchestrator.
 * Tek sorumluluğu: Alt bileşenleri bir araya getirmek.
 * İş mantığı / stiller her bileşenin kendi dosyasında.
 */
import { COLUMN_CONFIG, OrderColumn } from "./orders/OrderColumn";

export { StatCards } from "./orders/StatCards";

export function OrderColumns() {
	return (
		<div className="bg-dark-surface backdrop-blur-xl rounded-3xl border border-dark-border p-5">
			<div className="flex gap-4 overflow-x-auto pb-2">
				{COLUMN_CONFIG.map((col) => (
					<OrderColumn key={col.status} {...col} />
				))}
			</div>
		</div>
	);
}
