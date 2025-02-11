import { HomeAssistant } from 'custom-card-helpers';
import { ITimeSlot } from 'interfaces/slot.interface';
import { WeekDay } from '../const/days';
import { DayEntityConfig } from '../types/custom-types';
import { logger } from '../utils/logger';

export type StateChangeCallback = (day: WeekDay, value: string) => void;

export class HADataService {
	private static instance: HADataService;
	private hass?: HomeAssistant;
	private entities?: DayEntityConfig;
	private callbacks = new Set<StateChangeCallback>();

	private constructor() {}

	public static getInstance(): HADataService {
		if (!HADataService.instance) {
			HADataService.instance = new HADataService();
		}
		return HADataService.instance;
	}

	public initialize(hass: HomeAssistant, entities: DayEntityConfig): void {
		this.hass = hass;
		this.entities = entities;
		this.subscribeToEvents();
	}

	private subscribeToEvents(): void {
		if (!this.hass || !this.entities) return;

		this.hass.connection.subscribeEvents((event: any) => {
			const entityId = event.data?.entity_id;
			if (!entityId) return;

			// Find which day this entity belongs to
			const day = Object.entries(this.entities!).find(
				([_, id]) => id === entityId
			)?.[0] as WeekDay | undefined;

			if (day && event.data?.new_state?.state) {
				this.notifyStateChange(day, event.data.new_state.state);
			}
		}, 'state_changed');
	}

	public onStateChange(callback: StateChangeCallback): () => void {
		this.callbacks.add(callback);
		return () => this.callbacks.delete(callback);
	}

	private notifyStateChange(day: WeekDay, value: string): void {
		logger.debug(`HA state changed for ${day}:`, value);
		this.callbacks.forEach((cb) => cb(day, value));
	}

	public async loadState(day: WeekDay): Promise<string> {
		if (!this.hass || !this.entities) throw new Error('Not initialized');
		const state = this.hass.states[this.entities[day]];
		return state?.state || '';
	}

	public async saveState(day: WeekDay, value: string): Promise<void> {
		if (!this.hass || !this.entities) throw new Error('Not initialized');
		await this.hass.callService('input_text', 'set_value', {
			entity_id: this.entities[day],
			value,
		});
	}

	public async saveSchedule(day: WeekDay, slots: ITimeSlot[]): Promise<void> {
		if (!this.hass || !this.entities) throw new Error('Not initialized');

		try {
			// Convert to string format (no merging here anymore)
			const scheduleString = slots
				.map((slot) => `${slot.start}-${slot.end}`)
				.join(';');

			// Save to Home Assistant
			await this.hass.callService('input_text', 'set_value', {
				entity_id: this.entities[day],
				value: scheduleString,
			});

			// Wait for state to update
			await new Promise((resolve) => setTimeout(resolve, 50));
		} catch (error) {
			logger.error(`Failed to save schedule for ${day}:`, error);
			throw error;
		}
	}

	private parseScheduleString(value: string): ITimeSlot[] {
		if (!value) return [];
		return value.split(';').map((slot) => {
			const [start, end] = slot.split('-');
			return { start: start.trim(), end: end.trim() };
		});
	}

	public async getSchedule(day: WeekDay): Promise<ITimeSlot[]> {
		const state = await this.loadState(day);
		return this.parseScheduleString(state);
	}
}
