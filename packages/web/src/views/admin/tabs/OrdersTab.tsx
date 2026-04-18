import { OrderColumns, StatCards } from "../OrderColumns";
import { PageIntro } from "../ui/PageIntro";

export function OrdersTab() {
	return (
		<div className="space-y-6">
			<PageIntro eyebrow="Operasyon" title="Canlı Sipariş Akışı" />
			<StatCards />
			<OrderColumns />
		</div>
	);
}
