import { eq } from "drizzle-orm";
import type { AppDatabase } from "../db/connection.js";
import { announcementQueue } from "../db/schema.js";

export class AnnouncementService {
	constructor(private db: AppDatabase) {}

	/** Get next pending announcement (FIFO by enqueued_at) */
	getNextPending() {
		return (
			this.db
				.select()
				.from(announcementQueue)
				.where(eq(announcementQueue.status, "pending"))
				.orderBy(announcementQueue.enqueued_at)
				.limit(1)
				.get() ?? null
		);
	}

	/** Mark announcement as playing */
	markPlaying(id: string) {
		this.db
			.update(announcementQueue)
			.set({ status: "playing" })
			.where(eq(announcementQueue.id, id))
			.run();
	}

	/** Mark announcement as played */
	markPlayed(id: string) {
		this.db
			.update(announcementQueue)
			.set({
				status: "played",
				played_at: new Date().toISOString(),
			})
			.where(eq(announcementQueue.id, id))
			.run();
	}

	/**
	 * Reset any announcements stuck in "playing" state back to "pending".
	 * Called once on server startup. If the server crashed or was power-cycled
	 * while an announcement was playing, that row stays "playing" forever and
	 * the worker never picks it up again (it only queries "pending"). This
	 * ensures those announcements are replayed after restart.
	 */
	resetStuckAnnouncements() {
		this.db
			.update(announcementQueue)
			.set({ status: "pending" })
			.where(eq(announcementQueue.status, "playing"))
			.run();
	}

	/** Mark announcement as failed */
	markFailed(id: string, error: string) {
		this.db
			.update(announcementQueue)
			.set({ status: "failed", error })
			.where(eq(announcementQueue.id, id))
			.run();
	}
}
