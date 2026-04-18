import type {
	AnnouncementStatus,
	AnnouncementType,
	OrderStatus,
	OrderType,
	TerminalType,
} from "./constants.js";

// --- Orders ---

export interface Order {
	id: string;
	business_date: string;
	display_no: number;
	status: OrderStatus;
	terminal_id: string | null;
	customer_name: string | null;
	order_type: OrderType | null;
	target_minutes: number | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
	ready_at: string | null;
	delivered_at: string | null;
	cancelled_at: string | null;
	items?: OrderItem[];
}

export interface OrderItem {
	id: string;
	order_id: string;
	name: string;
	quantity: number;
	unit_price: number;
	notes: string | null;
}

export interface OrderEvent {
	id: string;
	order_id: string;
	from_status: OrderStatus | null;
	to_status: OrderStatus;
	terminal_id: string | null;
	created_at: string;
}

// --- Terminals ---

export interface Terminal {
	id: string;
	name: string;
	type: TerminalType;
	is_active: boolean;
	last_seen_at: string | null;
	created_at: string;
}

// --- Announcements ---

export interface AnnouncementQueueItem {
	id: string;
	order_id: string;
	display_no: number;
	type: AnnouncementType;
	status: AnnouncementStatus;
	enqueued_at: string;
	played_at: string | null;
	error: string | null;
}

// --- Stats ---

export interface DayStats {
	totalOrders: number;
	byStatus: Record<OrderStatus, number>;
	averagePrepMinutes: number | null;
	averageDeliverySeconds: number | null;
}

// --- Delivery Analytics ---

export type DeliveryAnalyticsGranularity = "hour" | "day";

export interface DeliveryAnalyticsSummary {
	averageDeliveryMinutes: number;
	totalDelivered: number;
	targetMinutes: number;
	previousPeriodAvgMinutes: number;
	trendPercent: number;
	onTargetRate: number;
	onTargetCount: number;
}

export interface DeliveryAnalyticsTimeSeriesPoint {
	bucket: string;
	averageDeliveryMinutes: number;
	deliveredCount: number;
}

export interface DeliveryAnalyticsTimeSeries {
	granularity: DeliveryAnalyticsGranularity;
	points: DeliveryAnalyticsTimeSeriesPoint[];
}

export interface DeliveryAnalyticsDistributionBucket {
	bucket: string;
	count: number;
}

export interface DeliveryAnalyticsByOrderType {
	orderType: OrderType;
	averageDeliveryMinutes: number;
	deliveredCount: number;
}

export interface DeliveryAnalyticsResult {
	range: {
		from: string;
		to: string;
	};
	summary: DeliveryAnalyticsSummary;
	timeSeries: DeliveryAnalyticsTimeSeries;
	distribution: DeliveryAnalyticsDistributionBucket[];
	byOrderType: DeliveryAnalyticsByOrderType[];
}

// --- API ---

export interface ApiResponse<T = unknown> {
	ok: true;
	data: T;
}

export interface ApiError {
	ok: false;
	error: {
		code: string;
		message: string;
	};
}

export interface CreateOrderInput {
	terminal_id?: string;
	customer_name: string;
	order_type: OrderType;
	target_minutes?: number;
	notes?: string;
	items?: CreateOrderItemInput[];
}

export interface CreateOrderItemInput {
	name: string;
	quantity: number;
	unit_price: number;
	notes?: string;
}

export interface UpdateStatusInput {
	status: OrderStatus;
	terminal_id?: string;
}

// --- WebSocket ---

export interface WsMessage<T = unknown> {
	event: string;
	data?: T;
	message?: string;
	timestamp: string;
}

export interface OrderStatusChangedPayload {
	id: string;
	display_no: number;
	status: OrderStatus;
	previousStatus: OrderStatus;
	ready_at?: string | null;
	delivered_at?: string | null;
	cancelled_at?: string | null;
}

export interface AnnouncementPayload {
	order_id: string;
	display_no: number;
}

export interface SettingsUpdatedPayload {
	key: string;
}

// --- Music ---

export interface MusicTrack {
	id: string;
	filename: string;
	display_name: string;
	file_size: number;
	duration_seconds: number | null;
	sort_order: number;
	uploaded_at: string;
}

/**
 * DB/internal music row shape. `file_path` is intentionally not exposed to clients.
 */
export interface MusicTrackRecord extends MusicTrack {
	file_path: string;
}

export interface MusicRuntimeIssue {
	code: string;
	message: string;
	at: string;
	signals: string[];
}

export interface MusicStatus {
	isPlaying: boolean;
	isPaused: boolean;
	isDucked: boolean;
	currentTrackId: string | null;
	currentTrackName: string | null;
	volume: number;
	enabled: boolean;
	loop: boolean;
	shuffle: boolean;
	runtimeIssue: MusicRuntimeIssue | null;
}
