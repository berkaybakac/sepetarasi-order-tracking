import type { Order, OrderType } from "@sepetarasi/shared";
import { useState } from "react";
import { api } from "../lib/api";

interface OrderFormProps {
	onCreated?: () => void;
}

const DEFAULT_ORDER_TYPE: OrderType = "Paket";

function formatDisplayNo(displayNo: number) {
	return String(displayNo).padStart(4, "0");
}

export function OrderForm({ onCreated }: OrderFormProps) {
	const [customerName, setCustomerName] = useState("");
	const [orderType, setOrderType] = useState<OrderType>(DEFAULT_ORDER_TYPE);
	const [notes, setNotes] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [printing, setPrinting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [printError, setPrintError] = useState<string | null>(null);
	const [lastPrintableOrder, setLastPrintableOrder] = useState<Order | null>(null);

	const printOrder = async (order: Order) => {
		if (!window.electronAPI) {
			return { ok: true };
		}
		return window.electronAPI.printReceipt(order);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setPrintError(null);

		if (!customerName.trim()) {
			setError("Müşteri adı giriniz");
			return;
		}

		setSubmitting(true);
		try {
			const order: Order = await api.createOrder({
				customer_name: customerName.trim(),
				order_type: orderType,
				notes: notes.trim() || undefined,
				items: [],
			});

			setLastPrintableOrder(order);
			const printResult = await printOrder(order);
			if (!printResult.ok) {
				setPrintError(
					`Sipariş #${formatDisplayNo(order.display_no)} oluşturuldu fakat fiş yazdırılamadı: ${printResult.error ?? "Bilinmeyen hata"}`,
				);
			}

			setCustomerName("");
			setOrderType(DEFAULT_ORDER_TYPE);
			setNotes("");
			onCreated?.();
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setSubmitting(false);
		}
	};

	const handleRetryPrint = async () => {
		if (!lastPrintableOrder) return;
		setPrinting(true);
		try {
			const result = await printOrder(lastPrintableOrder);
			if (result.ok) {
				setPrintError(null);
				return;
			}
			setPrintError(
				`Sipariş #${formatDisplayNo(lastPrintableOrder.display_no)} için fiş yeniden yazdırılamadı: ${result.error ?? "Bilinmeyen hata"}`,
			);
		} finally {
			setPrinting(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="bg-white rounded-xl p-4 shadow-sm overflow-hidden">
			<h2 className="text-xl font-bold mb-4">Yeni Sipariş</h2>

			<input
				type="text"
				placeholder="Müşteri adı"
				value={customerName}
				onChange={(e) => setCustomerName(e.target.value)}
				className="w-full border rounded-lg px-3 py-2 text-lg mb-3"
			/>

			<div className="flex gap-2 mb-3">
				<button
					type="button"
					onClick={() => setOrderType("Paket")}
					className={`flex-1 py-2 rounded-lg font-semibold text-base border-2 transition-colors ${
						orderType === "Paket"
							? "bg-indigo-600 border-indigo-600 text-white"
							: "bg-white border-gray-300 text-gray-600 hover:border-indigo-400"
					}`}
				>
					Paket
				</button>
				<button
					type="button"
					onClick={() => setOrderType("Masada")}
					className={`flex-1 py-2 rounded-lg font-semibold text-base border-2 transition-colors ${
						orderType === "Masada"
							? "bg-indigo-600 border-indigo-600 text-white"
							: "bg-white border-gray-300 text-gray-600 hover:border-indigo-400"
					}`}
				>
					Masada
				</button>
			</div>

			<textarea
				placeholder="Not (opsiyonel)"
				value={notes}
				onChange={(e) => setNotes(e.target.value)}
				className="w-full border rounded-lg px-3 py-2 mb-3 text-sm resize-none"
				rows={2}
			/>

			{error && <p className="text-red-500 text-sm mb-2">{error}</p>}

			{printError && lastPrintableOrder && (
				<div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
					<p className="font-medium">{printError}</p>
					<button
						type="button"
						onClick={handleRetryPrint}
						disabled={printing}
						className="mt-2 rounded-md border border-amber-500 px-3 py-1.5 font-semibold text-amber-900 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{printing ? "Yazdırılıyor..." : "Tekrar Yazdır"}
					</button>
				</div>
			)}

			<button
				type="submit"
				disabled={submitting || printing}
				className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg text-lg
					disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{submitting ? "Oluşturuluyor..." : "Sipariş Oluştur"}
			</button>
		</form>
	);
}
