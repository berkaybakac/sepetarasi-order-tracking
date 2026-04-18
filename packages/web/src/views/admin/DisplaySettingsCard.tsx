import {
	DISPLAY_LAYOUT_PREFERENCES,
	DISPLAY_PROFILES,
	DISPLAY_TEXT_SCALES,
	DISPLAY_THEMES,
	type DisplayLayoutPreference,
	type DisplayProfile,
	type DisplayTextScale,
	type DisplayTheme,
	areDisplayConfigsEqual,
	serializeDisplayConfig,
} from "@sepetarasi/shared";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
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
	hint: string;
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
				<p className="text-xs leading-5 text-text-subtle">{hint}</p>
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
	const summaryItems = useMemo(
		() => [
			{
				label: UI_LABELS.DISPLAY_SETTINGS.PROFILE_LABEL,
				value: PROFILE_LABELS[config.profile],
			},
			{
				label: UI_LABELS.DISPLAY_SETTINGS.LAYOUT_LABEL,
				value: LAYOUT_LABELS[config.layoutPreference],
			},
			{
				label: UI_LABELS.DISPLAY_SETTINGS.TEXT_SCALE_LABEL,
				value: TEXT_SCALE_LABELS[config.textScale],
			},
			{
				label: UI_LABELS.DISPLAY_SETTINGS.THEME_LABEL,
				value: THEME_LABELS[config.theme],
			},
			{
				label: UI_LABELS.DISPLAY_SETTINGS.MAX_PER_COLUMN_LABEL,
				value: `${config.maxVisiblePerColumn}`,
			},
			{
				label: UI_LABELS.DISPLAY_SETTINGS.PAGE_SECONDS_LABEL,
				value: `${config.pageSeconds} sn`,
			},
			{
				label: UI_LABELS.DISPLAY_SETTINGS.READY_DISPLAY_MINUTES_LABEL,
				value: `${config.readyDisplayMinutes} dk`,
			},
		],
		[config],
	);
	const summaryStatusLabel = dirty
		? "Kaydedilmedi"
		: feedback.isSuccess
			? UI_LABELS.SAVED
			: "Güncel";
	const summaryStatusClassName = dirty
		? "border-amber-400/20 bg-amber-500/10 text-amber-100"
		: feedback.isSuccess
			? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
			: "border-white/10 bg-white/6 text-text-muted";

	const handleResetDefaults = () => {
		setConfig(DEFAULT_DISPLAY_CONFIG);
		feedback.reset();
	};

	return (
		<SectionCard
			title={UI_LABELS.DISPLAY_SETTINGS.TITLE}
			icon={<DisplayIcon className="h-4 w-4" />}
		>
			{loading ? (
				<div className="space-y-4">
					<SkeletonBlock className="h-11 w-full" />
					<SkeletonBlock className="h-11 w-full" />
					<div className="grid gap-4 md:grid-cols-2">
						<SkeletonBlock className="h-11 w-full" />
						<SkeletonBlock className="h-11 w-full" />
					</div>
					<SkeletonBlock className="h-11 w-full" />
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
				<fieldset
					disabled={feedback.isPending}
					className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(18.5rem,0.95fr)]"
				>
					<div className="space-y-5">
						<div className="rounded-[1.35rem] border border-border-subtle bg-surface-1/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
							<Field
								htmlFor="restaurant-name"
								label={UI_LABELS.DISPLAY_SETTINGS.RESTAURANT_NAME_LABEL}
								hint="Marka adı ekranın üst bölümünde başlık olarak görünür."
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

						<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
							<DisplayControlCard
								label={UI_LABELS.DISPLAY_SETTINGS.PROFILE_LABEL}
								hint="İçerik yoğunluğunu ekran tipine göre dengeler."
							>
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

							<DisplayControlCard
								label={UI_LABELS.DISPLAY_SETTINGS.LAYOUT_LABEL}
								hint="Kolonların yan yana mı alt alta mı akacağını belirler."
							>
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

							<DisplayControlCard
								label={UI_LABELS.DISPLAY_SETTINGS.TEXT_SCALE_LABEL}
								hint="Uzak mesafeden okunabilirliği doğrudan etkiler."
							>
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

							<DisplayControlCard
								label={UI_LABELS.DISPLAY_SETTINGS.MAX_PER_COLUMN_LABEL}
								hint="Her kolonda aynı anda kaç sipariş gösterileceğini belirler."
							>
								<NumberStepper
									value={config.maxVisiblePerColumn}
									min={1}
									onChange={(value) =>
										setConfig((prev) => ({ ...prev, maxVisiblePerColumn: value }))
									}
									decreaseLabel={`${UI_LABELS.DISPLAY_SETTINGS.MAX_PER_COLUMN_LABEL} ${UI_LABELS.DISPLAY_SETTINGS.DECREASE}`}
									increaseLabel={`${UI_LABELS.DISPLAY_SETTINGS.MAX_PER_COLUMN_LABEL} ${UI_LABELS.DISPLAY_SETTINGS.INCREASE}`}
									inputLabel={UI_LABELS.DISPLAY_SETTINGS.MAX_PER_COLUMN_LABEL}
								/>
							</DisplayControlCard>

							<DisplayControlCard
								label={UI_LABELS.DISPLAY_SETTINGS.PAGE_SECONDS_LABEL}
								hint="Uzun listelerde sayfalar arası geçiş hızını kontrol eder."
							>
								<NumberStepper
									value={config.pageSeconds}
									min={1}
									onChange={(value) => setConfig((prev) => ({ ...prev, pageSeconds: value }))}
									decreaseLabel={`${UI_LABELS.DISPLAY_SETTINGS.PAGE_SECONDS_LABEL} ${UI_LABELS.DISPLAY_SETTINGS.DECREASE}`}
									increaseLabel={`${UI_LABELS.DISPLAY_SETTINGS.PAGE_SECONDS_LABEL} ${UI_LABELS.DISPLAY_SETTINGS.INCREASE}`}
									inputLabel={UI_LABELS.DISPLAY_SETTINGS.PAGE_SECONDS_LABEL}
								/>
							</DisplayControlCard>

							<DisplayControlCard
								label={UI_LABELS.DISPLAY_SETTINGS.READY_DISPLAY_MINUTES_LABEL}
								hint="Hazır siparişlerin ekranda kalma süresini sınırlar."
							>
								<NumberStepper
									value={config.readyDisplayMinutes}
									min={1}
									max={60}
									onChange={(value) =>
										setConfig((prev) => ({ ...prev, readyDisplayMinutes: value }))
									}
									decreaseLabel={`${UI_LABELS.DISPLAY_SETTINGS.READY_DISPLAY_MINUTES_LABEL} ${UI_LABELS.DISPLAY_SETTINGS.DECREASE}`}
									increaseLabel={`${UI_LABELS.DISPLAY_SETTINGS.READY_DISPLAY_MINUTES_LABEL} ${UI_LABELS.DISPLAY_SETTINGS.INCREASE}`}
									inputLabel={UI_LABELS.DISPLAY_SETTINGS.READY_DISPLAY_MINUTES_LABEL}
								/>
							</DisplayControlCard>

							<DisplayControlCard
								label={UI_LABELS.DISPLAY_SETTINGS.THEME_LABEL}
								hint="Müşteri ekranının genel renk atmosferini değiştirir."
								className="md:col-span-2 xl:col-span-3"
							>
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
						</div>
					</div>

					<div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
						<div className="rounded-[1.35rem] border border-border-subtle bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
							<div className="flex items-start justify-between gap-3">
								<div>
									<p className="text-sm font-semibold text-text-strong">Canlı Özet</p>
									<p className="mt-1 text-xs leading-5 text-text-subtle">
										Seçili profil ve gösteri tercihleri tek bakışta burada görünür.
									</p>
								</div>
								<span
									className={cn(
										"rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em]",
										summaryStatusClassName,
									)}
								>
									{summaryStatusLabel}
								</span>
							</div>

							<div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
								{summaryItems.map((item) => (
									<div
										key={item.label}
										className="rounded-[1rem] border border-border-subtle bg-surface-1/55 px-3 py-3"
									>
										<p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-text-subtle">
											{item.label}
										</p>
										<p className="mt-1 text-sm font-semibold text-text-strong">{item.value}</p>
									</div>
								))}
							</div>
						</div>

						<div className="rounded-[1.35rem] border border-border-subtle bg-surface-1/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
							<p className="text-sm font-semibold text-text-strong">Ekranı açıp kontrol et</p>
							<p className="mt-1 text-xs leading-5 text-text-subtle">
								Değişikliklerin etkisini ayrı sekmede anında görebilirsiniz.
							</p>

							<div className="mt-4 grid gap-3">
								<PreviewLink href="/display" label={UI_LABELS.DISPLAY_SETTINGS.OPEN_DISPLAY} />
								<PreviewLink
									href="/display/index.html"
									label={UI_LABELS.DISPLAY_SETTINGS.OPEN_TB1_DISPLAY}
									tone="accent"
								/>
							</div>
						</div>

						{feedback.isError && feedback.message ? (
							<InlineAlert tone="danger">{feedback.message}</InlineAlert>
						) : null}

						<div className="rounded-[1.35rem] border border-border-subtle bg-surface-1/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
							<p className="text-sm font-semibold text-text-strong">Aksiyonlar</p>
							<p className="mt-1 text-xs leading-5 text-text-subtle">
								{dirty
									? "Kaydetmeden çıkarsanız son değişiklikler uygulanmaz."
									: feedback.isSuccess
										? "Değişiklikler kaydedildi ve aktif görünüme gönderildi."
										: "Kayıtlı ayarlar aktif görünüm ile eşleşiyor."}
							</p>

							<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
								<ActionButton
									tone="secondary"
									className="w-full"
									onClick={handleResetDefaults}
									disabled={loading || feedback.isPending}
								>
									{UI_LABELS.DISPLAY_SETTINGS.RESET_DEFAULTS}
								</ActionButton>
								<ActionButton
									tone="primary"
									className="w-full"
									onClick={handleSave}
									busy={feedback.isPending}
									success={feedback.isSuccess}
									disabled={loading || !dirty}
								>
									{feedback.isSuccess ? UI_LABELS.SAVED : UI_LABELS.SAVE}
								</ActionButton>
							</div>
						</div>
					</div>
				</fieldset>
			)}
		</SectionCard>
	);
}
