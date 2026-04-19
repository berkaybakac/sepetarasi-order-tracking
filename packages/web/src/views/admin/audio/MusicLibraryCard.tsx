import type { MusicTrack } from "@sepetarasi/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { UI_LABELS } from "../../../constants/labels";
import { ApiError, api } from "../../../lib/api";
import { logger } from "../../../lib/logger";
import { useMusicStore } from "../../../stores/musicStore";
import { useOrderStore } from "../../../stores/orderStore";
import { getErrorMessage } from "../../../utils/error";
import { ActionButton, BaseAdminCard, BaseAdminCardSection, InlineAlert } from "../ui/primitives";

interface UploadItem {
	filename: string;
	progress: number;
	error: string | null;
	done: boolean;
}

interface MusicLibraryStatProps {
	label: string;
	value: string;
}

function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

	const units = ["B", "KB", "MB", "GB", "TB"];
	const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	const value = bytes / 1024 ** unitIndex;
	const digits = value >= 100 || unitIndex === 0 ? 0 : 1;
	return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function formatDuration(seconds: number | null): string {
	if (seconds === null || seconds === undefined) return "—";
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;
	if (hours > 0)
		return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

	return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function getMusicLibraryLoadErrorMessage(error: unknown) {
	if (error instanceof ApiError) {
		if (error.code === "UNAUTHORIZED") {
			return UI_LABELS.MUSIC_LIBRARY.LOAD_AUTH_ERROR;
		}

		if (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT" || error.code === "ABORTED") {
			return UI_LABELS.MUSIC_LIBRARY.LOAD_NETWORK_ERROR;
		}
	}

	return UI_LABELS.MUSIC_LIBRARY.LOAD_ERROR;
}

function MusicLibraryStat({ label, value }: MusicLibraryStatProps) {
	return (
		<BaseAdminCardSection className="px-3.5 py-3">
			<p className="text-xs font-medium text-text-subtle">{label}</p>
			<p className="mt-1 text-sm font-semibold text-text-strong">{value}</p>
		</BaseAdminCardSection>
	);
}

export function MusicLibraryCard() {
	const [tracks, setTracks] = useState<MusicTrack[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [uploads, setUploads] = useState<UploadItem[]>([]);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [diskInfo, setDiskInfo] = useState<{
		totalBytes: number;
		freeBytes: number;
		usedBytes: number;
	} | null>(null);
	const [selectMode, setSelectMode] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [bulkDeleting, setBulkDeleting] = useState(false);

	const status = useMusicStore((s) => s.status);
	const setMusicStatus = useMusicStore((s) => s.setStatus);
	const lastReconnectedAt = useOrderStore((s) => s.lastReconnectedAt);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const refreshDisk = useCallback(() => {
		api
			.getMusicDisk()
			.then((d) => {
				if (mountedRef.current) setDiskInfo(d);
			})
			.catch(() => undefined);
	}, []);

	const refreshMusicStatus = useCallback(() => {
		api
			.getMusicStatus()
			.then((s) => {
				if (mountedRef.current) setMusicStatus(s);
			})
			.catch(() => undefined);
	}, [setMusicStatus]);

	const loadTracks = useCallback(async () => {
		setLoading(true);
		setLoadError(null);

		try {
			const nextTracks = await api.getMusicTracks();
			if (!mountedRef.current) return;
			setTracks(nextTracks);
		} catch (error) {
			if (!mountedRef.current) return;
			logger.error("MusicLibraryCard", "Failed to load music tracks.", error);
			setLoadError(getMusicLibraryLoadErrorMessage(error));
		} finally {
			if (mountedRef.current) setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadTracks();
		refreshDisk();
		refreshMusicStatus();
	}, [loadTracks, refreshDisk, refreshMusicStatus]);

	useEffect(() => {
		if (lastReconnectedAt > 0 && loadError !== null) {
			void loadTracks();
			refreshDisk();
		}
	}, [lastReconnectedAt, loadError, loadTracks, refreshDisk]);

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files ?? []);
		if (files.length === 0) return;
		e.target.value = "";

		const items: UploadItem[] = files.map((f) => ({
			filename: f.name,
			progress: 0,
			error: null,
			done: false,
		}));
		setUploads(items);

		// Upload sequentially to avoid overwhelming Pi4.
		let anySucceeded = false;
		for (let i = 0; i < files.length; i++) {
			try {
				const newTrack = await api.uploadMusicTrack(files[i], (pct) =>
					setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, progress: pct } : u))),
				);
				setTracks((prev) => [...prev, newTrack]);
				setUploads((prev) =>
					prev.map((u, idx) => (idx === i ? { ...u, done: true, progress: 100 } : u)),
				);
				anySucceeded = true;
			} catch (err) {
				const msg = getErrorMessage(err, UI_LABELS.MUSIC_LIBRARY.UPLOAD_ERROR);
				setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, error: msg } : u)));
			}
		}

		if (anySucceeded) {
			refreshMusicStatus();
			refreshDisk();
		}
	};

	const handleDelete = (track: MusicTrack) => {
		if (!window.confirm(UI_LABELS.MUSIC_LIBRARY.CONFIRM_DELETE)) return;
		setDeletingId(track.id);
		api
			.deleteMusicTrack(track.id)
			.then(() => {
				setTracks((prev) => prev.filter((t) => t.id !== track.id));
				refreshMusicStatus();
				refreshDisk();
			})
			.catch((error) => logger.error("MusicLibraryCard", "Failed to delete music track.", error))
			.finally(() => setDeletingId(null));
	};

	const handleToggleSelectMode = () => {
		setSelectMode((prev) => !prev);
		setSelectedIds(new Set());
	};

	const handleToggleSelect = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const allSelected = tracks.length > 0 && selectedIds.size === tracks.length;

	const handleToggleSelectAll = () => {
		if (allSelected) {
			setSelectedIds(new Set());
		} else {
			setSelectedIds(new Set(tracks.map((t) => t.id)));
		}
	};

	const handleBulkDelete = async () => {
		if (selectedIds.size === 0) return;
		if (!window.confirm(`${selectedIds.size} parçayı silmek istediğinize emin misiniz?`)) return;

		setBulkDeleting(true);
		const idsToDelete = Array.from(selectedIds);
		for (const id of idsToDelete) {
			try {
				await api.deleteMusicTrack(id);
				setTracks((prev) => prev.filter((t) => t.id !== id));
				setSelectedIds((prev) => {
					const next = new Set(prev);
					next.delete(id);
					return next;
				});
			} catch (err) {
				logger.error("MusicLibraryCard", `Bulk delete failed for track ${id}.`, err);
			}
		}

		setBulkDeleting(false);
		setSelectMode(false);
		setSelectedIds(new Set());
		refreshMusicStatus();
		refreshDisk();
	};

	const totalSize = tracks.reduce((sum, t) => sum + t.file_size, 0);
	const diskUsagePercent =
		diskInfo && diskInfo.totalBytes > 0
			? Math.min(100, Math.round((diskInfo.usedBytes / diskInfo.totalBytes) * 100))
			: null;

	return (
		<BaseAdminCard
			title={UI_LABELS.MUSIC_LIBRARY.TITLE}
			icon={
				<svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<title>kütüphane ikonu</title>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
					/>
				</svg>
			}
			accent="violet"
			actions={
				<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:self-start">
					{!loadError && !selectMode ? (
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							disabled={uploads.some((u) => !u.done && !u.error)}
							className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40"
						>
							{uploads.some((u) => !u.done && !u.error)
								? UI_LABELS.MUSIC_LIBRARY.UPLOADING
								: UI_LABELS.MUSIC_LIBRARY.UPLOAD}
						</button>
					) : null}
					{!loadError && tracks.length > 0 ? (
						<button
							type="button"
							onClick={handleToggleSelectMode}
							disabled={bulkDeleting}
							className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
								selectMode
									? "border-white/20 bg-white/10 text-text-muted hover:bg-white/15"
									: "border-border-subtle bg-surface-1/45 text-text-subtle hover:bg-white/10 hover:text-text-muted"
							}`}
						>
							{selectMode
								? UI_LABELS.MUSIC_LIBRARY.SELECT_CANCEL
								: UI_LABELS.MUSIC_LIBRARY.SELECT_MODE}
						</button>
					) : null}
				</div>
			}
			bodyClassName="space-y-4"
		>
			<input
				ref={fileInputRef}
				type="file"
				accept="audio/mpeg,.mp3"
				multiple
				className="hidden"
				onChange={handleFileChange}
			/>

			<div className="space-y-3">
				{!loadError ? (
					<div className="grid gap-2 md:grid-cols-3">
						<MusicLibraryStat
							label={UI_LABELS.MUSIC_LIBRARY.TRACK_COUNT}
							value={`${tracks.length} parça`}
						/>
						<MusicLibraryStat
							label={UI_LABELS.MUSIC_LIBRARY.LIBRARY_SIZE}
							value={formatBytes(totalSize)}
						/>
						{diskInfo ? (
							<MusicLibraryStat
								label={UI_LABELS.MUSIC_LIBRARY.FREE_SPACE}
								value={formatBytes(diskInfo.freeBytes)}
							/>
						) : null}
					</div>
				) : null}

				{diskInfo && diskUsagePercent !== null ? (
					<BaseAdminCardSection>
						<div className="mb-2 flex items-center justify-between gap-3 text-xs text-text-subtle">
							<span>{UI_LABELS.MUSIC_LIBRARY.DISK_USAGE}</span>
							<span>
								{formatBytes(diskInfo.usedBytes)} / {formatBytes(diskInfo.totalBytes)}
							</span>
						</div>
						<div className="h-2 overflow-hidden rounded-full bg-slate-800">
							<div
								className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500"
								style={{ width: `${diskUsagePercent}%` }}
							/>
						</div>
					</BaseAdminCardSection>
				) : null}
			</div>

			{loadError ? (
				<div className="space-y-4 py-2">
					<InlineAlert tone="danger">{loadError}</InlineAlert>
					<div className="flex justify-end">
						<ActionButton tone="secondary" onClick={() => void loadTracks()}>
							{UI_LABELS.MUSIC_LIBRARY.RETRY_BUTTON}
						</ActionButton>
					</div>
				</div>
			) : (
				<>
					{/* Toplu Seçim Araç Çubuğu */}
					{selectMode ? (
						<BaseAdminCardSection className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
							<label className="flex cursor-pointer select-none items-center gap-2 text-xs text-text-subtle transition-colors hover:text-text-muted">
								<input
									type="checkbox"
									checked={allSelected}
									onChange={handleToggleSelectAll}
									className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
								/>
								{allSelected
									? UI_LABELS.MUSIC_LIBRARY.DESELECT_ALL
									: UI_LABELS.MUSIC_LIBRARY.SELECT_ALL}
							</label>
							{selectedIds.size > 0 && (
								<button
									type="button"
									onClick={handleBulkDelete}
									disabled={bulkDeleting}
									className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-500/15 border border-red-400/30 text-red-400 hover:bg-red-500/25 disabled:opacity-40 transition-all"
								>
									{bulkDeleting ? (
										<div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
									) : (
										<svg
											className="w-3.5 h-3.5"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<title>{UI_LABELS.MUSIC_LIBRARY.DELETE_SELECTED}</title>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/>
										</svg>
									)}
									{UI_LABELS.MUSIC_LIBRARY.DELETE_SELECTED} ({selectedIds.size})
								</button>
							)}
						</BaseAdminCardSection>
					) : null}

					{uploads.length > 0 ? (
						<div className="space-y-2">
							{uploads
								.filter((u) => !u.done)
								.map((u) => (
									<BaseAdminCardSection key={u.filename} className="p-3">
										<div className="flex items-center justify-between mb-2">
											<span
												className="max-w-[200px] truncate text-xs text-text-muted"
												title={u.filename}
											>
												{u.filename}
											</span>
											<span className="ml-2 shrink-0 text-xs text-text-subtle">
												{u.error ? "Hata" : `${u.progress}%`}
											</span>
										</div>
										{u.error ? (
											<p className="text-xs text-red-400">{u.error}</p>
										) : (
											<div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
												<div
													className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-150"
													style={{ width: `${u.progress}%` }}
												/>
											</div>
										)}
									</BaseAdminCardSection>
								))}
							{uploads.every((u) => u.done || u.error) && (
								<button
									type="button"
									onClick={() => setUploads([])}
									className="text-xs text-text-subtle hover:text-text-muted"
								>
									Kapat
								</button>
							)}
						</div>
					) : null}

					<BaseAdminCardSection className="space-y-2 p-3">
						<div className="max-h-[30rem] space-y-2 overflow-y-auto pr-1 lg:max-h-[36rem]">
							{loading && (
								<div className="flex justify-center py-8">
									<div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
								</div>
							)}

							{!loading && tracks.length === 0 && (
								<p className="py-8 text-center text-sm text-text-subtle">
									{UI_LABELS.MUSIC_LIBRARY.EMPTY}
								</p>
							)}

							{tracks.map((track, idx) => {
								const isActive = track.id === status?.currentTrackId;
								const isSelected = selectedIds.has(track.id);

								return (
									<div
										key={track.id}
										className={`flex items-center gap-3 p-3 rounded-2xl transition-colors group/item ${
											isActive
												? "border border-l-2 border-l-emerald-400/60 border-border-subtle bg-emerald-500/5"
												: "border border-border-subtle bg-surface-1/45 hover:bg-white/6"
										} ${selectMode ? "cursor-pointer" : ""}`}
										onClick={selectMode ? () => handleToggleSelect(track.id) : undefined}
										onKeyDown={
											selectMode
												? (e) => {
														if (e.key === "Enter" || e.key === " ") handleToggleSelect(track.id);
													}
												: undefined
										}
										role={selectMode ? "checkbox" : undefined}
										aria-checked={selectMode ? isSelected : undefined}
										tabIndex={selectMode ? 0 : undefined}
									>
										{selectMode ? (
											<input
												type="checkbox"
												checked={isSelected}
												onChange={() => handleToggleSelect(track.id)}
												onClick={(e) => e.stopPropagation()}
												className="w-4 h-4 shrink-0 rounded accent-indigo-500 cursor-pointer"
											/>
										) : isActive ? (
											<svg
												className="w-4 h-4 shrink-0 text-emerald-400"
												fill="currentColor"
												viewBox="0 0 24 24"
											>
												<title>Şu an çalıyor</title>
												<path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
											</svg>
										) : (
											<span className="w-5 shrink-0 text-right text-xs text-text-subtle">
												{idx + 1}
											</span>
										)}
										<div className="flex-1 min-w-0">
											<p
												className={`truncate text-sm ${isActive ? "font-medium text-emerald-300" : "text-text-strong"}`}
												title={track.display_name}
											>
												{track.display_name}
											</p>
											<p className="text-xs text-text-subtle">
												{formatBytes(track.file_size)} • {formatDuration(track.duration_seconds)}
											</p>
										</div>
										{!selectMode && (
											<button
												type="button"
												onClick={() => handleDelete(track)}
												disabled={deletingId === track.id}
												title={UI_LABELS.MUSIC_LIBRARY.DELETE}
												className="rounded-lg p-1.5 text-text-subtle transition-all hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
											>
												{deletingId === track.id ? (
													<div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
												) : (
													<svg
														className="w-4 h-4"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
													>
														<title>{UI_LABELS.MUSIC_LIBRARY.DELETE}</title>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={2}
															d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
														/>
													</svg>
												)}
											</button>
										)}
									</div>
								);
							})}
						</div>
					</BaseAdminCardSection>
				</>
			)}
		</BaseAdminCard>
	);
}
