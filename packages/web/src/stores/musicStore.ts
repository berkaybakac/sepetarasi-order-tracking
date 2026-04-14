import type { MusicStatus } from "@sepetarasi/shared";
import { create } from "zustand";

interface MusicState {
	status: MusicStatus | null;
	setStatus: (status: MusicStatus) => void;
}

export const useMusicStore = create<MusicState>((set) => ({
	status: null,
	setStatus: (status) => set({ status }),
}));
