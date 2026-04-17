import { OrderColumns, StatCards } from "../OrderColumns";
import { PageIntro } from "../ui/PageIntro";

export function OrdersTab() {
	return (
		<div className="space-y-6">
			<PageIntro
				eyebrow="Operasyon"
				title="Canlı Sipariş Akışı"
				description="Hazırlanan, hazır olan ve teslim edilen siparişleri tek bakışta takip edin. Yeni siparişler canlı akışla otomatik görünür."
			/>
			<StatCards />
			<OrderColumns />
		</div>
	);
}
