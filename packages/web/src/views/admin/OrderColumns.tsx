/**
 * OrderColumns — Orchestrator.
 * Tek sorumluluğu: Alt bileşenleri bir araya getirmek.
 * İş mantığı / stiller her bileşenin kendi dosyasında.
 */
import { COLUMN_CONFIG, OrderColumn } from "./orders/OrderColumn";
import { SectionCard } from "./ui/primitives";

export { StatCards } from "./orders/StatCards";

export function OrderColumns() {
	return (
		<SectionCard
			title="Sipariş Panosu"
			description="Her kolon ilgili akışı canlı gösterir. Kartlar süre ve öncelik durumuna göre vurgulanır."
		>
			<div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
				{COLUMN_CONFIG.map((col) => (
					<OrderColumn key={col.status} {...col} />
				))}
			</div>
		</SectionCard>
	);
}
