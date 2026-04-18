import type { MusicTrack } from "@sepetarasi/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { UI_LABELS } from "../../../constants/labels";
import { ApiError, api } from "../../../lib/api";
import { logger } from "../../../lib/logger";
import { useMusicStore } from "../../../stores/musicStore";
import { ActionButton, InlineAlert } from "../ui/primitives";

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
		<div className="rounded-2xl border border-white/5 bg-black/10 px-3.5 py-3">
			<p className="text-xs font-medium text-slate-400">{label}</p>
			<p className="mt-1 text-sm font-semibold text-white">{value}</p>
		</div>
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
	const fileInputRef = useRef<HTMLInputElement>(null);

	const refreshDisk = useCallback(() => {
		api
			.getMusicDisk()
			.then(setDiskInfo)
			.catch(() => undefined);
	}, []);

	const refreshMusicStatus = useCallback(() => {
		api
			.getMusicStatus()
			.then(setMusicStatus)
			.catch(() => undefined);
	}, [setMusicStatus]);

	const loadTracks = useCallback(async () => {
		setLoading(true);
		setLoadError(null);

		try {
			const nextTracks = await api.getMusicTracks();
			setTracks(nextTracks);
		} catch (error) {
			logger.error("MusicLibraryCard", "Failed to load music tracks.", error);
			setLoadError(getMusicLibraryLoadErrorMessage(error));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadTracks();
		refreshDisk();
	}, [loadTracks, refreshDisk]);

	useEffect(() => {
		api
			.getMusicStatus()
			.then(setMusicStatus)
			.catch(() => undefined);
	}, [setMusicStatus]);

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
		for (let i = 0; i < files.length; i++) {
			try {
				const newTrack = await api.uploadMusicTrack(files[i], (pct) =>
					setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, progress: pct } : u))),
				);
				setTracks((prev) => [...prev, newTrack]);
				setUploads((prev) =>
					prev.map((u, idx) => (idx === i ? { ...u, done: true, progress: 100 } : u)),
				);
			} catch (err) {
				const msg = err instanceof Error ? err.message : UI_LABELS.MUSIC_LIBRARY.UPLOAD_ERROR;
				setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, error: msg } : u)));
			}
		}

		refreshMusicStatus();
		refreshDisk();
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
		<div className="bg-white/5 backdrop-blur-xl rounded-3xl shadow-lg shadow-black/20 border border-white/5 p-6 relative overflow-hidden group hover:border-white/10 transition-colors min-h-full">
			<div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

			<div className="relative z-10 mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<h3 className="flex min-w-0 flex-1 items-center gap-2 text-base font-semibold text-slate-100">
					<svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<title>kütüphane ikonu</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
						/>
					</svg>
					<span className="min-w-0 leading-tight break-words">{UI_LABELS.MUSIC_LIBRARY.TITLE}</span>
				</h3>

				<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:self-start">
					{!loadError && !selectMode && (
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							disabled={uploads.some((u) => !u.done && !u.error)}
							className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-40 transition-all"
						>
							{uploads.some((u) => !u.done && !u.error)
								? UI_LABELS.MUSIC_LIBRARY.UPLOADING
								: UI_LABELS.MUSIC_LIBRARY.UPLOAD}
						</button>
					)}
					{!loadError && tracks.length > 0 && (
						<button
							type="button"
							onClick={handleToggleSelectMode}
							disabled={bulkDeleting}
							className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
								selectMode
									? "bg-white/10 border-white/20 text-slate-200 hover:bg-white/15"
									: "bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10"
							}`}
						>
							{selectMode
								? UI_LABELS.MUSIC_LIBRARY.SELECT_CANCEL
								: UI_LABELS.MUSIC_LIBRARY.SELECT_MODE}
						</button>
					)}
				</div>
				<input
					ref={fileInputRef}
					type="file"
					accept="audio/mpeg,.mp3"
					multiple
					className="hidden"
					onChange={handleFileChange}
				/>
			</div>

			<div className="relative z-10 mb-4 space-y-3">
				{!loadError ? (
					<div className="grid gap-2 sm:grid-cols-3">
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
					<div className="rounded-2xl border border-white/5 bg-black/10 px-4 py-3">
						<div className="mb-2 flex items-center justify-between text-xs text-slate-400">
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
					</div>
				) : null}
			</div>

			{loadError ? (
				<div className="relative z-10 space-y-4 py-2">
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
					{selectMode && (
						<div className="relative z-10 flex items-center justify-between mb-3 px-1">
							<label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-400 hover:text-slate-200 transition-colors">
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
						</div>
					)}

					{uploads.length > 0 && (
						<div className="relative z-10 mb-4 space-y-2">
							{uploads
								.filter((u) => !u.done)
								.map((u) => (
									<div
										key={u.filename}
										className="p-3 bg-white/5 rounded-2xl border border-white/5"
									>
										<div className="flex items-center justify-between mb-2">
											<span
												className="text-xs text-slate-300 truncate max-w-[200px]"
												title={u.filename}
											>
												{u.filename}
											</span>
											<span className="text-xs text-slate-400 ml-2 shrink-0">
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
									</div>
								))}
							{uploads.every((u) => u.done || u.error) && (
								<button
									type="button"
									onClick={() => setUploads([])}
									className="text-xs text-slate-500 hover:text-slate-300"
								>
									Kapat
								</button>
							)}
						</div>
					)}

					<div className="relative z-10 space-y-2 max-h-[30rem] overflow-y-auto pr-1 lg:max-h-[36rem]">
						{loading && (
							<div className="flex justify-center py-8">
								<div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
							</div>
						)}

						{!loading && tracks.length === 0 && (
							<p className="text-center text-sm text-slate-600 py-8">
								{UI_LABELS.MUSIC_LIBRARY.EMPTY}
							</p>
						)}

						{tracks.map((track, idx) => {
							const isActive = track.id === status?.currentTrackId;
							const isSelected = selectedIds.has(track.id);

							return (
								<div
									key={track.id}
									className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors group/item ${
										isActive
											? "border-l-2 border-emerald-400/60 bg-emerald-500/5 border-r border-t border-b border-white/5"
											: "bg-white/3 hover:bg-white/5 border-white/5"
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
										<span className="text-xs text-slate-600 w-5 text-right shrink-0">
											{idx + 1}
										</span>
									)}
									<div className="flex-1 min-w-0">
										<p
											className={`text-sm truncate ${isActive ? "text-emerald-300 font-medium" : "text-white"}`}
											title={track.display_name}
										>
											{track.display_name}
										</p>
										<p className="text-xs text-slate-600">
											{formatBytes(track.file_size)} • {formatDuration(track.duration_seconds)}
										</p>
									</div>
									{!selectMode && (
										<button
											type="button"
											onClick={() => handleDelete(track)}
											disabled={deletingId === track.id}
											title={UI_LABELS.MUSIC_LIBRARY.DELETE}
											className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30"
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
				</>
			)}
		</div>
	);
}
