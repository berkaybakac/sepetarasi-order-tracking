import type { CreateOrderItemInput } from "@sepetarasi/shared";
import { useState } from "react";
import { api } from "../lib/api";

interface OrderFormProps {
	onCreated?: () => void;
}

interface OrderFormItem extends CreateOrderItemInput {
	_id: number;
}

let _nextId = 0;
const newItem = (): OrderFormItem => ({ _id: _nextId++, name: "", quantity: 1, unit_price: 0 });

export function OrderForm({ onCreated }: OrderFormProps) {
	const [items, setItems] = useState<OrderFormItem[]>([newItem()]);
	const [notes, setNotes] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const addItem = () => {
		setItems([...items, newItem()]);
	};

	const removeItem = (index: number) => {
		if (items.length <= 1) return;
		setItems(items.filter((_, i) => i !== index));
	};

	const updateItem = (index: number, field: keyof CreateOrderItemInput, value: string | number) => {
		const updated = [...items];
		updated[index] = { ...updated[index], [field]: value };
		setItems(updated);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		const validItems = items.filter((item) => item.name.trim() !== "");
		if (validItems.length === 0) {
			setError("En az bir ürün ekleyin");
			return;
		}

		// Convert TL to kuruş
		const itemsWithKurus = validItems.map((item) => ({
			...item,
			name: item.name.trim(),
			unit_price: Math.round(item.unit_price * 100),
		}));

		setSubmitting(true);
		try {
			await api.createOrder({
				items: itemsWithKurus,
				notes: notes.trim() || undefined,
			});

			// Reset form
			setItems([newItem()]);
			setNotes("");
			onCreated?.();
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="bg-white rounded-xl p-4 shadow-sm overflow-hidden">
			<h2 className="text-xl font-bold mb-4">Yeni Sipariş</h2>

			{items.map((item, index) => (
				<div key={item._id} className="flex gap-2 mb-2 items-center min-w-0">
					<input
						type="text"
						placeholder="Ürün adı"
						value={item.name}
						onChange={(e) => updateItem(index, "name", e.target.value)}
						className="flex-1 min-w-0 border rounded-lg px-3 py-2 text-lg"
					/>
					<input
						type="number"
						min="1"
						value={item.quantity}
						onChange={(e) => updateItem(index, "quantity", Number.parseInt(e.target.value) || 1)}
						className="w-14 sm:w-16 shrink-0 border rounded-lg px-3 py-2 text-lg text-center"
					/>
					<div className="relative shrink-0">
						<input
							type="number"
							min="0"
							step="0.01"
							placeholder="0.00"
							value={item.unit_price || ""}
							onChange={(e) =>
								updateItem(index, "unit_price", Number.parseFloat(e.target.value) || 0)
							}
							className="w-24 sm:w-28 border rounded-lg px-3 py-2 text-lg pr-8"
						/>
						<span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">TL</span>
					</div>
					{items.length > 1 && (
						<button
							type="button"
							onClick={() => removeItem(index)}
							className="text-red-400 hover:text-red-600 text-xl px-2"
						>
							✕
						</button>
					)}
				</div>
			))}

			<button
				type="button"
				onClick={addItem}
				className="text-blue-500 hover:text-blue-700 text-sm mb-3"
			>
				+ Ürün ekle
			</button>

			<textarea
				placeholder="Not (opsiyonel)"
				value={notes}
				onChange={(e) => setNotes(e.target.value)}
				className="w-full border rounded-lg px-3 py-2 mb-3 text-sm resize-none"
				rows={2}
			/>

			{error && <p className="text-red-500 text-sm mb-2">{error}</p>}

			<button
				type="submit"
				disabled={submitting}
				className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg text-lg
					disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{submitting ? "Oluşturuluyor..." : "Sipariş Oluştur"}
			</button>
		</form>
	);
}
