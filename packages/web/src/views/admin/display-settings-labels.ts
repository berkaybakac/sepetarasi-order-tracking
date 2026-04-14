import type {
	DisplayLayoutPreference,
	DisplayProfile,
	DisplayTextScale,
	DisplayTheme,
} from "@sepetarasi/shared";
import { UI_LABELS } from "../../constants/labels";

export const PROFILE_LABELS: Record<DisplayProfile, string> = {
	auto: UI_LABELS.DISPLAY_SETTINGS.AUTO_OPTION,
	led_256x512: "LED 256x512",
	tv_1080p: "TV 1080p",
};

export const LAYOUT_LABELS: Record<DisplayLayoutPreference, string> = {
	auto: UI_LABELS.DISPLAY_SETTINGS.AUTO_OPTION,
	split: UI_LABELS.DISPLAY_SETTINGS.LAYOUT_SPLIT,
	stack: UI_LABELS.DISPLAY_SETTINGS.LAYOUT_STACK,
};

export const TEXT_SCALE_LABELS: Record<DisplayTextScale, string> = {
	s: UI_LABELS.DISPLAY_SETTINGS.TEXT_SCALE_S,
	m: UI_LABELS.DISPLAY_SETTINGS.TEXT_SCALE_M,
	l: UI_LABELS.DISPLAY_SETTINGS.TEXT_SCALE_L,
};

export const THEME_LABELS: Record<DisplayTheme, string> = {
	dark: UI_LABELS.DISPLAY_SETTINGS.THEME_DARK,
	light: UI_LABELS.DISPLAY_SETTINGS.THEME_LIGHT,
	vivid: UI_LABELS.DISPLAY_SETTINGS.THEME_VIVID,
	retro: UI_LABELS.DISPLAY_SETTINGS.THEME_RETRO,
};
