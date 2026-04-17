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
import { useEffect, useState } from "react";
import { DisplayIcon, ExternalLinkIcon } from "../../components/icons";
import { UI_LABELS } from "../../constants/labels";
import { useActionFeedback } from "../../hooks/useActionFeedback";
import { api } from "../../lib/api";
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

export function DisplaySettingsCard() {
	const [config, setConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG);
	const [savedConfig, setSavedConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY_CONFIG);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const feedback = useActionFeedback();

	useEffect(() => {
		api
			.getSettings()
			.then((settings) => {
				const parsed = parseDisplaySettings(settings);
				setConfig(parsed);
				setSavedConfig(parsed);
				setLoadError(null);
			})
			.catch((error) => {
				logger.error("DisplaySettingsCard", "Failed to load display settings.", error);
				setLoadError(UI_LABELS.DISPLAY_SETTINGS.LOAD_ERROR);
			})
			.finally(() => setLoading(false));
	}, []);

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

	return (
		<SectionCard
			title={UI_LABELS.DISPLAY_SETTINGS.TITLE}
			description="Bu ayarlar müşteri ekranındaki bilgi yoğunluğunu, tempo hissini ve görsel karakteri belirler."
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
			) : (
				<fieldset disabled={feedback.isPending} className="grid grid-cols-1 gap-4">
					<Field
						htmlFor="restaurant-name"
						label={UI_LABELS.DISPLAY_SETTINGS.RESTAURANT_NAME_LABEL}
						hint="Ekranın üst kısmında marka adı olarak görünür."
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

					<div className="grid gap-4 md:grid-cols-2">
						<Field
							label={UI_LABELS.DISPLAY_SETTINGS.PROFILE_LABEL}
							hint="Ekranın içerik yoğunluğunu cihaz tipine göre şekillendirir."
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
						</Field>

						<Field
							label={UI_LABELS.DISPLAY_SETTINGS.LAYOUT_LABEL}
							hint="Sipariş kolonlarının yan yana mı yoksa üst üste mi gösterileceğini belirler."
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
						</Field>
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<Field
							label={UI_LABELS.DISPLAY_SETTINGS.MAX_PER_COLUMN_LABEL}
							hint="Kolon başına görünen sipariş sayısını belirler."
						>
							<NumberStepper
								value={config.maxVisiblePerColumn}
								min={1}
								onChange={(value) => setConfig((prev) => ({ ...prev, maxVisiblePerColumn: value }))}
								decreaseLabel={`${UI_LABELS.DISPLAY_SETTINGS.MAX_PER_COLUMN_LABEL} ${UI_LABELS.DISPLAY_SETTINGS.DECREASE}`}
								increaseLabel={`${UI_LABELS.DISPLAY_SETTINGS.MAX_PER_COLUMN_LABEL} ${UI_LABELS.DISPLAY_SETTINGS.INCREASE}`}
								inputLabel={UI_LABELS.DISPLAY_SETTINGS.MAX_PER_COLUMN_LABEL}
							/>
						</Field>

						<Field
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
						</Field>
					</div>

					<Field
						label={UI_LABELS.DISPLAY_SETTINGS.READY_DISPLAY_MINUTES_LABEL}
						hint="Hazır siparişlerin müşteri ekranında ne kadar süre görünür kalacağını belirler."
					>
						<NumberStepper
							value={config.readyDisplayMinutes}
							min={1}
							max={60}
							onChange={(value) => setConfig((prev) => ({ ...prev, readyDisplayMinutes: value }))}
							decreaseLabel={`${UI_LABELS.DISPLAY_SETTINGS.READY_DISPLAY_MINUTES_LABEL} ${UI_LABELS.DISPLAY_SETTINGS.DECREASE}`}
							increaseLabel={`${UI_LABELS.DISPLAY_SETTINGS.READY_DISPLAY_MINUTES_LABEL} ${UI_LABELS.DISPLAY_SETTINGS.INCREASE}`}
							inputLabel={UI_LABELS.DISPLAY_SETTINGS.READY_DISPLAY_MINUTES_LABEL}
						/>
					</Field>

					<div className="grid gap-4 md:grid-cols-2">
						<Field
							label={UI_LABELS.DISPLAY_SETTINGS.TEXT_SCALE_LABEL}
							hint="Uzak mesafeden okunabilirliği etkiler."
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
						</Field>

						<Field
							label={UI_LABELS.DISPLAY_SETTINGS.THEME_LABEL}
							hint="Müşteri ekranının genel renk atmosferini değiştirir."
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
						</Field>
					</div>

					{loadError ? <InlineAlert tone="danger">{loadError}</InlineAlert> : null}
					{feedback.isError && feedback.message ? (
						<InlineAlert tone="danger">{feedback.message}</InlineAlert>
					) : null}
				</fieldset>
			)}

			<div className="mt-6 flex flex-col gap-3 border-t border-border-subtle pt-5 md:flex-row md:items-center md:justify-between">
				<p className="text-sm text-text-subtle">
					Bu ekranın etkisini anında görmek için müşteri görünümünü ayrı sekmede açabilirsiniz.
				</p>
				<div className="flex flex-wrap items-center gap-3">
					<a
						href="/display"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex h-11 items-center justify-center gap-2 rounded-[1rem] border border-border-strong bg-white/8 px-4 text-sm font-semibold text-text-strong"
					>
						<ExternalLinkIcon className="h-4 w-4" />
						{UI_LABELS.DISPLAY_SETTINGS.OPEN_DISPLAY}
					</a>
					<ActionButton
						tone="ghost"
						onClick={handleResetDefaults}
						disabled={loading || feedback.isPending}
					>
						{UI_LABELS.DISPLAY_SETTINGS.RESET_DEFAULTS}
					</ActionButton>
					<ActionButton
						tone="primary"
						onClick={handleSave}
						busy={feedback.isPending}
						success={feedback.isSuccess}
						disabled={loading || !dirty}
					>
						{feedback.isSuccess ? UI_LABELS.SAVED : UI_LABELS.SAVE}
					</ActionButton>
				</div>
			</div>
		</SectionCard>
	);
}
