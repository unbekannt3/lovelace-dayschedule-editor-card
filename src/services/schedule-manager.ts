import { HomeAssistant } from 'custom-card-helpers';
import { ITimeSlot } from '../interfaces/slot.interface';
import { DayEntityConfig } from '../types/custom-types';
import { logger } from '../utils/logger';

export class ScheduleManager {
	protected hass: HomeAssistant | undefined;
	protected entities: DayEntityConfig;

	constructor(hass: HomeAssistant | undefined, entities: DayEntityConfig) {
		this.hass = hass;
		this.entities = entities;
		if (!entities) {
			throw new Error('Entities configuration is required for ScheduleManager');
		}
	}

	public updateHass(hass: HomeAssistant): void {
		this.hass = hass;
	}

	private ensureHass(): void {
		if (!this.hass) {
			throw new Error('Home Assistant instance not available');
		}
	}

	private parseScheduleString(input: string | null | undefined): ITimeSlot[] {
		if (!input || input.trim() === '') {
			logger.debug('Empty input, returning empty array');
			return [];
		}

		try {
			logger.debug('Parsing schedule string:', input);
			const slots = input
				.split(';')
				.map((slot) => slot.trim())
				.filter((slot) => slot !== '');

			logger.debug('Split into slots:', slots);

			const parsedSlots = slots
				.map((slot) => {
					if (!this.isValidTimeRangeFormat(slot)) {
						logger.warn(
							`Invalid time range format: "${slot}", expected "HH:MM-HH:MM"`
						);
						return null;
					}

					const [start, end] = slot.split('-').map((t) => t.trim());
					logger.debug(`Parsed slot - start: ${start}, end: ${end}`);
					return { start, end };
				})
				.filter((slot): slot is ITimeSlot => slot !== null);

			logger.debug('Final parsed slots:', parsedSlots);
			return parsedSlots;
		} catch (error) {
			logger.warn('Failed to parse schedule:', error);
			return [];
		}
	}

	private isValidTimeRangeFormat(timeRange: string): boolean {
		const timePattern =
			/^([0-1][0-9]|2[0-3]):[0-5][0-9]-([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
		return timePattern.test(timeRange);
	}

	private formatScheduleString(slots: ITimeSlot[]): string {
		return slots.map((slot) => `${slot.start}-${slot.end}`).join(';');
	}

	async loadSchedule(day: string): Promise<ITimeSlot[]> {
		this.ensureHass();
		if (!this.hass) return [];

		const entityId = this.entities[day as keyof DayEntityConfig];
		const state = this.hass.states[entityId];

		if (!state) {
			logger.warn(`No state found for entity: ${entityId}`);
			return [];
		}

		logger.debug(`Loading schedule for ${day}:`, state.state);
		return this.parseScheduleString(state.state);
	}

	async saveSchedule(day: string, slots: ITimeSlot[]): Promise<void> {
		this.ensureHass();
		if (!this.hass) return;

		const entityId = this.entities[day as keyof DayEntityConfig];
		await this.hass.callService('input_text', 'set_value', {
			entity_id: entityId,
			value: this.formatScheduleString(slots),
		});
	}
}
