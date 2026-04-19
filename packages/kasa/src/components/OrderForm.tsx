import type { Order, OrderType } from "@sepetarasi/shared";
import { parseNotePresets } from "@sepetarasi/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

interface OrderFormProps {
	onCreated?: () => void;
}

const DEFAULT_ORDER_TYPE: OrderType = "Paket";

function formatDisplayNo(displayNo: number) {
	return String(displayNo).padStart(4, "0");
}

function ensureSentence(text: string) {
	const trimmed = text.trim();
	if (!trimmed) return "Bilinmeyen hata.";
	if (/[.!?]$/.test(trimmed)) return trimmed;
	return `${trimmed}.`;
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
	const [lastSelectedPreset, setLastSelectedPreset] = useState<string | null>(null);
	const [showPresetFade, setShowPresetFade] = useState(false);
	const presetsContainerRef = useRef<HTMLDivElement | null>(null);

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

	const updatePresetFade = useCallback(() => {
		const container = presetsContainerRef.current;
		if (!container) {
			setShowPresetFade(false);
			return;
		}

		const maxScrollTop = container.scrollHeight - container.clientHeight;
		setShowPresetFade(maxScrollTop > 1 && container.scrollTop < maxScrollTop - 1);
	}, []);

	useEffect(() => {
		updatePresetFade();
		window.addEventListener("resize", updatePresetFade);
		return () => window.removeEventListener("resize", updatePresetFade);
	}, [updatePresetFade]);

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
					`Sipariş #${formatDisplayNo(order.display_no)} oluşturuldu. Fiş yazdırılamadı. ${ensureSentence(printResult.error ?? "Bilinmeyen hata")}`,
				);
			} else {
				setLastPrintableOrder(null);
			}

			setCustomerName("");
			setOrderType(DEFAULT_ORDER_TYPE);
			setNotes("");
			setLastSelectedPreset(null);
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
				`Sipariş #${formatDisplayNo(lastPrintableOrder.display_no)} için fiş yeniden yazdırılamadı. ${ensureSentence(result.error ?? "Bilinmeyen hata")}`,
			);
		} finally {
			setPrinting(false);
		}
	};

	const handlePresetClick = (preset: string) => {
		setLastSelectedPreset(preset);
		if (notes.trim()) {
			setNotes(`${notes.trim()}, ${preset}`);
		} else {
			setNotes(preset);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col p-5">
			<div
				data-testid="order-form-scroll"
				className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1"
			>
				<h2 className="text-base font-bold text-slate-400 uppercase tracking-widest">
					Yeni Sipariş
				</h2>

				{/* Müşteri Adı */}
				<div>
					<label
						htmlFor={customerInputId}
						className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400"
					>
						Müşteri Adı
					</label>
					<input
						id={customerInputId}
						type="text"
						placeholder="Adı giriniz"
						spellCheck={false}
						value={customerName}
						onChange={(e) => setCustomerName(e.target.value)}
						maxLength={60}
						className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-base text-white placeholder-slate-400 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					/>
				</div>

				{/* Sipariş Tipi */}
				<fieldset>
					<legend className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
						Sipariş Tipi
					</legend>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setOrderType("Paket")}
							className={`flex-1 rounded-lg border-2 py-3 text-base font-bold transition-all active:scale-95 ${
								orderType === "Paket"
									? "border-emerald-500 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.25)]"
									: "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:text-white"
							}`}
						>
							Paket
						</button>
						<button
							type="button"
							onClick={() => setOrderType("Masada")}
							className={`flex-1 rounded-lg border-2 py-3 text-base font-bold transition-all active:scale-95 ${
								orderType === "Masada"
									? "border-emerald-500 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.25)]"
									: "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:text-white"
							}`}
						>
							Masada
						</button>
					</div>
				</fieldset>

				{/* Not */}
				<div className="flex min-h-0 flex-col">
					<label
						htmlFor={notesTextareaId}
						className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400"
					>
						Not <span className="font-normal normal-case text-slate-500">(opsiyonel)</span>
					</label>
					<textarea
						id={notesTextareaId}
						placeholder="Özel istek, alerji bilgisi..."
						spellCheck={false}
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						maxLength={300}
						className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-400 transition-colors [overflow-wrap:anywhere] [word-break:break-word] focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						rows={2}
					/>

					{lastSelectedPreset && (
						<div
							data-testid="selected-preset-preview"
							className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
						>
							<p className="mb-1 uppercase tracking-[0.18em] text-[0.65rem] font-semibold text-emerald-300/80">
								Seçilen hazır not
							</p>
							<p className="leading-relaxed [overflow-wrap:anywhere] [word-break:break-word]">
								{lastSelectedPreset}
							</p>
						</div>
					)}

					{/* Hızlı Not Presetleri */}
					{presets.length > 0 && (
						<div className="relative mt-3 min-h-0">
							<div
								data-testid="order-form-presets"
								ref={presetsContainerRef}
								onScroll={updatePresetFade}
								className="flex max-h-[clamp(10rem,32vh,18rem)] flex-wrap items-start gap-2 overflow-y-auto pr-1"
							>
								{presets.map((preset) => (
									<button
										key={preset}
										type="button"
										onClick={() => handlePresetClick(preset)}
										className="inline-flex max-w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-full border border-emerald-500/50 bg-emerald-500/20 px-3 py-1.5 text-left text-xs font-medium leading-snug text-emerald-300 transition-colors hover:border-emerald-500 hover:bg-emerald-500/30 active:scale-95 active:bg-emerald-500/40"
									>
										<span className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
											{preset}
										</span>
									</button>
								))}
							</div>
							{showPresetFade && (
								<div
									data-testid="order-form-presets-fade"
									className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-2xl bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent"
								/>
							)}
						</div>
					)}
				</div>
			</div>

			<div
				data-testid="order-form-footer"
				className="relative mt-auto shrink-0 space-y-4 border-t border-white/[0.08] bg-slate-900/95 pb-0 pt-5 shadow-[0_-18px_32px_rgba(2,6,23,0.38)] before:pointer-events-none before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-gradient-to-t before:from-slate-900/80 before:to-transparent"
			>
				{/* Hata mesajı */}
				{error && (
					<p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
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
					className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-5 text-xl font-bold text-white shadow-[0_0_28px_rgba(16,185,129,0.30)] transition-all duration-150 hover:from-emerald-400 hover:to-teal-400 hover:shadow-[0_0_36px_rgba(16,185,129,0.45)] active:scale-[0.98] active:from-emerald-600 active:to-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{submitting ? "Oluşturuluyor..." : "Sipariş Ver"}
				</button>
			</div>
		</form>
	);
}
