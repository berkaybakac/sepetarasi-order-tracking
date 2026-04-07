import { create } from "zustand";

interface AuthState {
	isAdmin: boolean | null; // null represents "loading" checking state
	login: () => void;
	logout: () => void;
	setAuthStatus: (status: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
	isAdmin: null,
	login: () => set({ isAdmin: true }),
	logout: () => set({ isAdmin: false }),
	setAuthStatus: (status: boolean) => set({ isAdmin: status }),
}));
