import {
	DISPLAY_LAYOUT_PREFERENCES,
	DISPLAY_PROFILES,
	DISPLAY_TEXT_SCALES,
	DISPLAY_THEMES,
	type DisplayLayoutPreference,
	type DisplayProfile,
	type DisplayTextScale,
	type DisplayTheme,
	TB1_DISPLAY_PROFILE_ROUTES,
	areDisplayConfigsEqual,
	serializeDisplayConfig,
} from "@sepetarasi/shared";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { DisplayIcon, ExternalLinkIcon } from "../../components/icons";
import { UI_LABELS } from "../../constants/labels";
import { useActionFeedback } from "../../hooks/useActionFeedback";
import { ApiError, api } from "../../lib/api";
import { cn } from "../../lib/cn";
import { logger } from "../../lib/logger";
import {
	DEFAULT_DISPLAY_CONFIG,
	type DisplayConfig,
	parseDisplaySettings,
} from "../display/display-config";
import {
	LAYOUT_LABELS,
	PROFILE_LABELS,
	TEXT_SCALE_LABELS,
	THEME_LABELS,
} from "./display-settings-labels";
import {
	ActionButton,
	Field,
	InlineAlert,
	NumberStepper,
	SectionCard,
	SelectInput,
	SkeletonBlock,
	TextInput,
} from "./ui/primitives";

interface DisplayControlCardProps {
	label: string;
	hint?: string;
	children: ReactNode;
	className?: string;
}

function DisplayControlCard({ label, hint, children, className }: DisplayControlCardProps) {
	return (
		<div
			className={cn(
				"rounded-[1.25rem] border border-border-subtle bg-surface-1/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
				className,
			)}
		>
			<div className="mb-3 space-y-1">
				<p className="text-sm font-semibold text-text-strong">{label}</p>
				{hint ? <p className="text-xs leading-5 text-text-subtle">{hint}</p> : null}
			</div>
			{children}
		</div>
	);
}

interface PreviewLinkProps {
	href: string;
	label: string;
	tone?: "default" | "accent";
}

function resolveTb1DisplayOrigin() {
	if (typeof window === "undefined") return "";

	const explicitOrigin =
		import.meta.env.VITE_DISPLAY_SERVER_ORIGIN?.trim() || import.meta.env.VITE_API_URL?.trim();
	if (explicitOrigin) {
		try {
			return new URL(explicitOrigin, window.location.origin).origin;
		} catch {
			return window.location.origin;
		}
	}

	if (!import.meta.env.DEV) {
		return window.location.origin;
	}

	const devOrigin = new URL(window.location.origin);
	if (devOrigin.port === "3000") return devOrigin.origin;
	devOrigin.port = "3000";
	return devOrigin.origin;
}

function buildTb1DisplayHref(path: string) {
	return `${resolveTb1DisplayOrigin()}${path}`;
}

function PreviewLink({ href, label, tone = "default" }: PreviewLinkProps) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className={cn(
				"inline-flex min-h-11 items-center justify-between gap-3 rounded-[1rem] border px-4 py-3 text-sm font-semibold transition",
				tone === "accent"
					? "border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/14"
					: "border-border-strong bg-white/8 text-text-strong hover:bg-white/12 hover:border-white/20",
			)}
		>
			<span className="flex min-w-0 items-center gap-2">
				<ExternalLinkIcon className="h-4 w-4 shrink-0" />
				<span className="truncate">{label}</span>
			</span>
		</a>
	);
}

function getDisplaySettingsLoadErrorMessage(error: unknown) {
	if (error instanceof ApiError) {
		if (error.code === "UNAUTHORIZED") {
			return UI_LABELS.DISPLAY_SETTINGS.LOAD_AUTH_ERROR;
		}

		if (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT" || error.code === "ABORTED") {
			return UI_LABELS.DISPLAY_SETTINGS.LOAD_NETWORK_ERROR;
		}
	}

	return UI_LABELS.DISPLAY_SETTINGS.LOAD_ERROR;
}

export function DisplaySettingsCard() {
	const [config, setConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG);
	const [savedConfig, setSavedConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const feedback = useActionFeedback();

	const loadDisplaySettings = useCallback(async () => {
		setLoading(true);
		setLoadError(null);

		try {
			const settings = await api.getPublicSettings();
			const parsed = parseDisplaySettings(settings);
			setConfig(parsed);
			setSavedConfig(parsed);
		} catch (error) {
			logger.error("DisplaySettingsCard", "Failed to load display settings.", error);
			setLoadError(getDisplaySettingsLoadErrorMessage(error));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadDisplaySettings();
	}, [loadDisplaySettings]);

	const handleSave = async () => {
		feedback.setPending();
		try {
			await api.updateSettingsBulk(serializeDisplayConfig(config));
			setSavedConfig(config);
			feedback.setSuccess(UI_LABELS.SAVED);
		} catch (error) {
			logger.error("DisplaySettingsCard", "Failed to save display settings.", error);
			feedback.setError(error, UI_LABELS.DISPLAY_SETTINGS.SAVE_ERROR);
		}
	};

	const dirty = !areDisplayConfigsEqual(config, savedConfig);

	const handleResetDefaults = () => {
		setConfig(DEFAULT_DISPLAY_CONFIG);
		feedback.reset();
	};

	const tb1DisplayLinks = {
		led256x512: buildTb1DisplayHref(TB1_DISPLAY_PROFILE_ROUTES.led_256x512),
		led344x344: buildTb1DisplayHref(TB1_DISPLAY_PROFILE_ROUTES.led_344_square),
		led512x512: buildTb1DisplayHref(TB1_DISPLAY_PROFILE_ROUTES.led_512_square),
	};

	return (
		<SectionCard
			title={UI_LABELS.DISPLAY_SETTINGS.TITLE}
			icon={<DisplayIcon className="h-4 w-4" />}
		>
			{loading ? (
				<div className="space-y-5">
					<SkeletonBlock className="h-16 w-full" />
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
						<SkeletonBlock className="h-24 w-full" />
						<SkeletonBlock className="h-24 w-full" />
						<SkeletonBlock className="h-24 w-full" />
						<SkeletonBlock className="h-24 w-full" />
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						<SkeletonBlock className="h-24 w-full" />
						<SkeletonBlock className="h-24 w-full" />
						<SkeletonBlock className="h-24 w-full" />
					</div>
					<SkeletonBlock className="h-14 w-full" />
				</div>
			) : loadError ? (
				<div className="space-y-4">
					<InlineAlert tone="danger">{loadError}</InlineAlert>
					<div className="flex justify-end">
						<ActionButton tone="secondary" onClick={() => void loadDisplaySettings()}>
							{UI_LABELS.DISPLAY_SETTINGS.RETRY_BUTTON}
						</ActionButton>
					</div>
				</div>
			) : (
				<fieldset disabled={feedback.isPending} className="space-y-5">
					<div className="rounded-[1.35rem] border border-border-subtle bg-surface-1/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
						<Field
							htmlFor="restaurant-name"
							label={UI_LABELS.DISPLAY_SETTINGS.RESTAURANT_NAME_LABEL}
						>
							<TextInput
								id="restaurant-name"
								type="text"
								maxLength={60}
								value={config.restaurantName}
								onChange={(event) =>
									setConfig((prev) => ({ ...prev, restaurantName: event.target.value }))
								}
								placeholder={UI_LABELS.DISPLAY_SETTINGS.RESTAURANT_NAME_PLACEHOLDER}
							/>
						</Field>
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<DisplayControlCard label={UI_LABELS.DISPLAY_SETTINGS.THEME_LABEL}>
							<SelectInput
								value={config.theme}
								onChange={(event) =>
									setConfig((prev) => ({ ...prev, theme: event.target.value as DisplayTheme }))
								}
							>
								{DISPLAY_THEMES.map((theme) => (
									<option key={theme} value={theme}>
										{THEME_LABELS[theme]}
									</option>
								))}
							</SelectInput>
						</DisplayControlCard>

						<DisplayControlCard label={UI_LABELS.DISPLAY_SETTINGS.READY_DISPLAY_MINUTES_LABEL}>
							<NumberStepper
								value={config.readyDisplayMinutes}
								min={1}
								max={60}
								onChange={(value) => setConfig((prev) => ({ ...prev, readyDisplayMinutes: value }))}
								decreaseLabel={`${UI_LABELS.DISPLAY_SETTINGS.READY_DISPLAY_MINUTES_LABEL} ${UI_LABELS.DISPLAY_SETTINGS.DECREASE}`}
								increaseLabel={`${UI_LABELS.DISPLAY_SETTINGS.READY_DISPLAY_MINUTES_LABEL} ${UI_LABELS.DISPLAY_SETTINGS.INCREASE}`}
								inputLabel={UI_LABELS.DISPLAY_SETTINGS.READY_DISPLAY_MINUTES_LABEL}
							/>
						</DisplayControlCard>
					</div>

					{feedback.isError && feedback.message ? (
						<InlineAlert tone="danger">{feedback.message}</InlineAlert>
					) : null}

					<div className="rounded-[1.35rem] border border-border-subtle bg-surface-1/45 p-4">
						<div className="flex flex-wrap gap-3">
							<PreviewLink
								href={tb1DisplayLinks.led256x512}
								label={UI_LABELS.DISPLAY_SETTINGS.OPEN_TB1_256_DISPLAY}
								tone="accent"
							/>
							<PreviewLink
								href={tb1DisplayLinks.led344x344}
								label={UI_LABELS.DISPLAY_SETTINGS.OPEN_TB1_344_DISPLAY}
								tone="accent"
							/>
							<PreviewLink
								href={tb1DisplayLinks.led512x512}
								label={UI_LABELS.DISPLAY_SETTINGS.OPEN_TB1_512_DISPLAY}
								tone="accent"
							/>
						</div>
					</div>

					<details className="rounded-[1.35rem] border border-border-subtle bg-surface-1/45 p-4">
						<summary className="cursor-pointer list-none text-sm font-semibold text-text-strong">
							{UI_LABELS.DISPLAY_SETTINGS.ADVANCED_TITLE}
						</summary>
						<p className="mt-2 text-xs leading-5 text-text-subtle">
							{UI_LABELS.DISPLAY_SETTINGS.ADVANCED_HINT}
						</p>

						<div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
							<DisplayControlCard label={UI_LABELS.DISPLAY_SETTINGS.PROFILE_LABEL}>
								<SelectInput
									value={config.profile}
									onChange={(event) =>
										setConfig((prev) => ({
											...prev,
											profile: event.target.value as DisplayProfile,
										}))
									}
								>
									{DISPLAY_PROFILES.map((profile) => (
										<option key={profile} value={profile}>
											{PROFILE_LABELS[profile]}
										</option>
									))}
								</SelectInput>
							</DisplayControlCard>

							<DisplayControlCard label={UI_LABELS.DISPLAY_SETTINGS.LAYOUT_LABEL}>
								<SelectInput
									value={config.layoutPreference}
									onChange={(event) =>
										setConfig((prev) => ({
											...prev,
											layoutPreference: event.target.value as DisplayLayoutPreference,
										}))
									}
								>
									{DISPLAY_LAYOUT_PREFERENCES.map((layoutPreference) => (
										<option key={layoutPreference} value={layoutPreference}>
											{LAYOUT_LABELS[layoutPreference]}
										</option>
									))}
								</SelectInput>
							</DisplayControlCard>

							<DisplayControlCard label={UI_LABELS.DISPLAY_SETTINGS.TEXT_SCALE_LABEL}>
								<SelectInput
									value={config.textScale}
									onChange={(event) =>
										setConfig((prev) => ({
											...prev,
											textScale: event.target.value as DisplayTextScale,
										}))
									}
								>
									{DISPLAY_TEXT_SCALES.map((textScale) => (
										<option key={textScale} value={textScale}>
											{TEXT_SCALE_LABELS[textScale]}
										</option>
									))}
								</SelectInput>
							</DisplayControlCard>

							<DisplayControlCard label={UI_LABELS.DISPLAY_SETTINGS.MAX_PER_COLUMN_LABEL}>
								<NumberStepper
									value={config.maxVisiblePerColumn}
									min={1}
									max={99}
									onChange={(value) =>
										setConfig((prev) => ({ ...prev, maxVisiblePerColumn: value }))
									}
									decreaseLabel={`${UI_LABELS.DISPLAY_SETTINGS.MAX_PER_COLUMN_LABEL} ${UI_LABELS.DISPLAY_SETTINGS.DECREASE}`}
									increaseLabel={`${UI_LABELS.DISPLAY_SETTINGS.MAX_PER_COLUMN_LABEL} ${UI_LABELS.DISPLAY_SETTINGS.INCREASE}`}
									inputLabel={UI_LABELS.DISPLAY_SETTINGS.MAX_PER_COLUMN_LABEL}
								/>
							</DisplayControlCard>
						</div>

						<div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
							<DisplayControlCard label={UI_LABELS.DISPLAY_SETTINGS.PAGE_SECONDS_LABEL}>
								<NumberStepper
									value={config.pageSeconds}
									min={1}
									max={120}
									onChange={(value) => setConfig((prev) => ({ ...prev, pageSeconds: value }))}
									decreaseLabel={`${UI_LABELS.DISPLAY_SETTINGS.PAGE_SECONDS_LABEL} ${UI_LABELS.DISPLAY_SETTINGS.DECREASE}`}
									increaseLabel={`${UI_LABELS.DISPLAY_SETTINGS.PAGE_SECONDS_LABEL} ${UI_LABELS.DISPLAY_SETTINGS.INCREASE}`}
									inputLabel={UI_LABELS.DISPLAY_SETTINGS.PAGE_SECONDS_LABEL}
								/>
							</DisplayControlCard>

							<div className="flex items-end">
								<PreviewLink href="/display" label={UI_LABELS.DISPLAY_SETTINGS.OPEN_DISPLAY} />
							</div>
						</div>
					</details>

					<div className="flex justify-end">
						<div className="flex shrink-0 gap-3">
							<ActionButton
								tone="secondary"
								onClick={handleResetDefaults}
								disabled={loading || feedback.isPending}
							>
								{UI_LABELS.DISPLAY_SETTINGS.RESET_DEFAULTS}
							</ActionButton>
							<ActionButton
								tone="primary"
								onClick={() => void handleSave()}
								busy={feedback.isPending}
								success={feedback.isSuccess}
								disabled={loading || !dirty}
							>
								{feedback.isSuccess ? UI_LABELS.SAVED : UI_LABELS.SAVE}
							</ActionButton>
						</div>
					</div>
				</fieldset>
			)}
		</SectionCard>
	);
}
