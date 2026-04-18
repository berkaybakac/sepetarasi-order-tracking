import type { ComponentType } from "react";
import {
	AudioIcon,
	DisplayIcon,
	type IconProps,
	NotesIcon,
	OrdersIcon,
	StatsIcon,
} from "../../components/icons";

export interface AdminTabDefinition {
	to: string;
	label: string;
	Icon: ComponentType<IconProps>;
}

export const ADMIN_TABS: AdminTabDefinition[] = [
	{
		to: "/admin/orders",
		label: "Siparişler",
		Icon: OrdersIcon,
	},
	{
		to: "/admin/stats",
		label: "İstatistikler",
		Icon: StatsIcon,
	},
	{
		to: "/admin/audio",
		label: "Anons & Müzik",
		Icon: AudioIcon,
	},
	{
		to: "/admin/display",
		label: "Ekran",
		Icon: DisplayIcon,
	},
	{
		to: "/admin/notes",
		label: "Hızlı Notlar",
		Icon: NotesIcon,
	},
] as const;
