import type { FastifyInstance } from "fastify";
import type { AppDatabase } from "../db/connection.js";
import type { MusicPlayerService } from "../services/music-player.service.js";
import { registerMusicControlRoutes } from "./music/control-routes.js";
import { registerMusicLibraryRoutes } from "./music/library-routes.js";

export function registerMusicRoutes(
	app: FastifyInstance,
	db: AppDatabase,
	musicPath: string,
	musicPlayer: MusicPlayerService | null,
	maxUploadBytes: number,
): void {
	registerMusicLibraryRoutes(app, db, musicPath, musicPlayer, maxUploadBytes);
	registerMusicControlRoutes(app, db, musicPlayer);
}
