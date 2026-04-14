import { OrderColumns, StatCards } from "../OrderColumns";

export function OrdersTab() {
	return (
		<div className="space-y-6">
			<StatCards />
			<OrderColumns />
		</div>
	);
}
