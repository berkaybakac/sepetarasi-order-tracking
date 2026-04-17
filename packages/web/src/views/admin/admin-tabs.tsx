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
	description: string;
	Icon: ComponentType<IconProps>;
}

export const ADMIN_TABS: AdminTabDefinition[] = [
	{
		to: "/admin/orders",
		label: "Siparişler",
		description: "Canlı sipariş akışını izleyin, darboğazları hızlıca görün.",
		Icon: OrdersIcon,
	},
	{
		to: "/admin/stats",
		label: "İstatistikler",
		description: "Teslimat performansını tarih aralıklarına göre okuyun.",
		Icon: StatsIcon,
	},
	{
		to: "/admin/audio",
		label: "Anons & Müzik",
		description: "Anons ve müzik davranışını tek merkezden yönetin.",
		Icon: AudioIcon,
	},
	{
		to: "/admin/display",
		label: "Ekran",
		description: "Müşteri ekranının görünümünü ve bilgi yoğunluğunu ayarlayın.",
		Icon: DisplayIcon,
	},
	{
		to: "/admin/notes",
		label: "Hızlı Notlar",
		description: "Kasadaki sık kullanılan notları standardize edin.",
		Icon: NotesIcon,
	},
] as const;
