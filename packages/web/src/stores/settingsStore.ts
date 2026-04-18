import { DELIVERY_TARGET_DEFAULT_MINUTES, SETTING_KEYS } from "@sepetarasi/shared";
import { create } from "zustand";
import { api } from "../lib/api";

interface SettingsState {
	deliveryTargetMinutes: number;
	loaded: boolean;
	loadFailed: boolean;
	hydrate: () => Promise<void>;
	setDeliveryTargetMinutes: (value: number) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
	deliveryTargetMinutes: DELIVERY_TARGET_DEFAULT_MINUTES,
	loaded: false,
	loadFailed: false,
	hydrate: async () => {
		try {
			const settings = await api.getPublicSettings();
			const raw = settings[SETTING_KEYS.DELIVERY_TARGET_MINUTES];
			const parsed = raw != null ? Number(raw) : Number.NaN;
			set({
				deliveryTargetMinutes:
					Number.isFinite(parsed) && parsed > 0 ? parsed : DELIVERY_TARGET_DEFAULT_MINUTES,
				loaded: true,
				loadFailed: false,
			});
		} catch {
			set({ loaded: true, loadFailed: true });
		}
	},
	setDeliveryTargetMinutes: (value) => set({ deliveryTargetMinutes: value }),
}));
