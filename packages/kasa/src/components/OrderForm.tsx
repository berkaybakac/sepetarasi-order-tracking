import type { Order, OrderType } from "@sepetarasi/shared";
import { parseNotePresets } from "@sepetarasi/shared";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface OrderFormProps {
	onCreated?: () => void;
}

const DEFAULT_ORDER_TYPE: OrderType = "Paket";

function formatDisplayNo(displayNo: number) {
	return String(displayNo).padStart(4, "0");
}

export function OrderForm({ onCreated }: OrderFormProps) {
	const customerInputId = "customer-name";
	const notesTextareaId = "order-notes";

	const [customerName, setCustomerName] = useState("");
	const [orderType, setOrderType] = useState<OrderType>(DEFAULT_ORDER_TYPE);
	const [notes, setNotes] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [printing, setPrinting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [printError, setPrintError] = useState<string | null>(null);
	const [lastPrintableOrder, setLastPrintableOrder] = useState<Order | null>(null);
	const [presets, setPresets] = useState<string[]>([]);

	useEffect(() => {
		const loadPresets = () => {
			api
				.getPublicSettings()
				.then((settings) => setPresets(parseNotePresets(settings)))
				.catch((err) => {
					console.error("[OrderForm] getPublicSettings failed:", err);
				});
		};
		loadPresets();
		const interval = setInterval(loadPresets, 30_000);
		return () => clearInterval(interval);
	}, []);

	const printOrder = async (order: Order) => {
		if (!window.electronAPI) {
			return { ok: true };
		}
		return window.electronAPI.printReceipt(order);
	};

	const handleSubmit = async (e: { preventDefault(): void }) => {
		e.preventDefault();
		if (submitting) return;
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
			});

			setLastPrintableOrder(order);
			const printResult = await printOrder(order);
			if (!printResult.ok) {
				setPrintError(
					`Sipariş #${formatDisplayNo(order.display_no)} oluşturuldu fakat fiş yazdırılamadı: ${printResult.error ?? "Bilinmeyen hata"}`,
				);
			} else {
				setLastPrintableOrder(null);
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

	const handlePresetClick = (preset: string) => {
		if (notes.trim()) {
			setNotes(`${notes.trim()}, ${preset}`);
		} else {
			setNotes(preset);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
			<h2 className="text-base font-bold text-slate-400 uppercase tracking-widest">Yeni Sipariş</h2>

			{/* Müşteri Adı */}
			<div>
				<label
					htmlFor={customerInputId}
					className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5"
				>
					Müşteri Adı
				</label>
				<input
					id={customerInputId}
					type="text"
					placeholder="Adı giriniz"
					value={customerName}
					onChange={(e) => setCustomerName(e.target.value)}
					maxLength={60}
					className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-400 rounded-lg px-4 py-3 text-base focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
				/>
			</div>

			{/* Sipariş Tipi */}
			<fieldset>
				<legend className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
					Sipariş Tipi
				</legend>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => setOrderType("Paket")}
						className={`flex-1 py-3 rounded-lg font-bold text-base border-2 transition-all active:scale-95 ${
							orderType === "Paket"
								? "bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.25)]"
								: "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"
						}`}
					>
						Paket
					</button>
					<button
						type="button"
						onClick={() => setOrderType("Masada")}
						className={`flex-1 py-3 rounded-lg font-bold text-base border-2 transition-all active:scale-95 ${
							orderType === "Masada"
								? "bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.25)]"
								: "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"
						}`}
					>
						Masada
					</button>
				</div>
			</fieldset>

			{/* Not */}
			<div>
				<label
					htmlFor={notesTextareaId}
					className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5"
				>
					Not <span className="text-slate-500 normal-case font-normal">(opsiyonel)</span>
				</label>
				<textarea
					id={notesTextareaId}
					placeholder="Özel istek, alerji bilgisi..."
					value={notes}
					onChange={(e) => setNotes(e.target.value)}
					maxLength={300}
					className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-400 rounded-lg px-4 py-3 text-sm resize-none [overflow-wrap:anywhere] [word-break:break-word] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
					rows={2}
				/>

				{/* Hızlı Not Presetleri */}
				{presets.length > 0 && (
					<div className="mt-3 flex flex-wrap gap-2">
						{presets.map((preset) => (
							<button
								key={preset}
								type="button"
								onClick={() => handlePresetClick(preset)}
								className="inline-flex px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-medium hover:bg-emerald-500/30 hover:border-emerald-500 transition-colors active:scale-95 active:bg-emerald-500/40"
							>
								{preset}
							</button>
						))}
					</div>
				)}
			</div>

			{/* Hata mesajı */}
			{error && (
				<p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
					{error}
				</p>
			)}

			{/* Fiş hatası */}
			{printError && lastPrintableOrder && (
				<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
					<p className="font-medium">{printError}</p>
					<button
						type="button"
						onClick={handleRetryPrint}
						disabled={printing}
						className="mt-3 rounded-lg border border-amber-600/50 px-3 py-2 font-semibold text-amber-400 transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{printing ? "Yazdırılıyor..." : "Tekrar Yazdır"}
					</button>
				</div>
			)}

			{/* Submit */}
			<button
				type="submit"
				disabled={submitting || printing}
				className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:from-emerald-600 active:to-teal-600 text-white font-bold py-5 rounded-xl text-xl shadow-[0_0_28px_rgba(16,185,129,0.30)] hover:shadow-[0_0_36px_rgba(16,185,129,0.45)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.98]"
			>
				{submitting ? "Oluşturuluyor..." : "Sipariş Ver"}
			</button>
		</form>
	);
}
