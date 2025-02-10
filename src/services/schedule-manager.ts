import { WeekDay, WEEKDAYS } from 'const/days';
import { HomeAssistant } from 'custom-card-helpers';
import { ITimeSlot } from '../interfaces/slot.interface';
import { DayEntityConfig } from '../types/custom-types';
import { logger } from '../utils/logger';
import { mergeOverlappingSlots } from '../utils/time-utils';
import { StateManager } from './state-manager';

// Neue Typdefinitionen für HA Websocket Messages
interface StateChangedEvent {
	data?: {
		entity_id: string;
		new_state?: {
			state: string;
		};
	};
}

interface CrossDaySlot {
	currentDay: ITimeSlot;
	nextDay: ITimeSlot;
}

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

	public updateHass(hass: HomeAssistant | undefined): void {
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

	private isCrossDaySlot(slot: ITimeSlot): boolean {
		const [startHours, startMinutes] = slot.start.split(':').map(Number);
		const [endHours, endMinutes] = slot.end.split(':').map(Number);

		// Wenn die Endzeit kleiner als die Startzeit ist oder wenn die Endzeit 00:00 ist
		return (
			endHours < startHours ||
			(endHours === 0 && endMinutes === 0 && startHours > 0)
		);
	}

	private splitCrossDaySlot(slot: ITimeSlot): CrossDaySlot {
		return {
			currentDay: {
				start: slot.start,
				end: '23:59',
			},
			nextDay: {
				start: '00:00',
				end: slot.end,
			},
		};
	}

	private getNextDay(day: WeekDay): WeekDay {
		const dayIndex = WEEKDAYS.indexOf(day);
		return WEEKDAYS[(dayIndex + 1) % WEEKDAYS.length];
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

	private processSlotsForDay(
		currentSlots: ITimeSlot[],
		slotsToProcess: ITimeSlot[]
	): ITimeSlot[] {
		let updatedSlots = [...currentSlots];

		slotsToProcess.forEach((slot) => {
			const [startHours, startMinutes] = slot.start.split(':').map(Number);
			const [endHours, endMinutes] = slot.end.split(':').map(Number);

			const startTotal = startHours * 60 + startMinutes;
			let endTotal = endHours * 60 + endMinutes;

			// Wenn Endzeit kleiner als Startzeit, dann auf 23:59 setzen
			if (endTotal < startTotal) {
				updatedSlots = updatedSlots.filter(
					(existing) => existing.start !== slot.start
				);
				updatedSlots.push({
					start: slot.start,
					end: '23:59',
				});
			} else {
				updatedSlots = updatedSlots.filter(
					(existing) => existing.start !== slot.start
				);
				updatedSlots.push(slot);
			}
		});

		return updatedSlots;
	}

	private processNextDaySlots(
		currentSlots: ITimeSlot[],
		slotsToProcess: ITimeSlot[]
	): ITimeSlot[] {
		let updatedSlots = [...currentSlots];

		slotsToProcess.forEach((slot) => {
			const [startHours, startMinutes] = slot.start.split(':').map(Number);
			const [endHours, endMinutes] = slot.end.split(':').map(Number);

			const startTotal = startHours * 60 + startMinutes;
			let endTotal = endHours * 60 + endMinutes;

			// if end time is less than start time go to next day and create two slots
			if (endTotal < startTotal) {
				updatedSlots = updatedSlots.filter((existing) =>
					existing.start === '00:00' ? false : true
				);
				updatedSlots.push({
					start: '00:00',
					end: slot.end,
				});
			}
		});

		return updatedSlots;
	}

	private async waitForStateUpdate(entityId: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			let unsubscribe: (() => Promise<void>) | undefined;
			const timeout = setTimeout(async () => {
				if (unsubscribe) await unsubscribe();
				// resolve even when timeout is reached as the state might have been updated anyway
				resolve();
			}, 1000);

			this.hass!.connection.subscribeMessage(
				async (message: StateChangedEvent) => {
					if (message.data?.entity_id === entityId) {
						clearTimeout(timeout);
						if (unsubscribe) await unsubscribe();
						resolve();
					}
				},
				{ type: 'subscribe_events', event_type: 'state_changed' }
			).then((unsub) => {
				unsubscribe = unsub;
			});
		});
	}

	async saveSchedule(day: string, slots: ITimeSlot[]): Promise<void> {
		this.ensureHass();
		if (!this.hass) return;

		const stateManager = StateManager.getInstance();

		try {
			const currentDay = day as WeekDay;
			const nextDay = this.getNextDay(currentDay);

			// Slots für beide Tage vorbereiten
			const currentDaySlots = this.processSlotsForDay([], slots);
			const existingNextDaySlots = await this.loadSchedule(nextDay);
			const nextDaySlots = this.processNextDaySlots(
				existingNextDaySlots,
				slots
			);

			// Formatierte Strings vorbereiten
			const currentDayString = this.formatScheduleString(
				mergeOverlappingSlots(currentDaySlots)
			);
			const nextDayString = this.formatScheduleString(
				mergeOverlappingSlots(nextDaySlots)
			);

			// Optimistisches Update
			stateManager.updateState(currentDay, currentDaySlots);
			if (nextDaySlots.length > 0) {
				stateManager.updateState(nextDay, nextDaySlots);
			}

			// Aktuellen Tag speichern
			await this.hass.callService('input_text', 'set_value', {
				entity_id: this.entities[currentDay],
				value: currentDayString,
			});
			await this.waitForStateUpdate(this.entities[currentDay]);

			// Nächsten Tag speichern wenn nötig
			if (nextDaySlots.length > 0) {
				await this.hass.callService('input_text', 'set_value', {
					entity_id: this.entities[nextDay],
					value: nextDayString,
				});
				await this.waitForStateUpdate(this.entities[nextDay]);
			}

			// Nochmal Update für sicheres Rendering
			setTimeout(() => {
				stateManager.updateState(currentDay, currentDaySlots);
				if (nextDaySlots.length > 0) {
					stateManager.updateState(nextDay, nextDaySlots);
				}
			}, 50);

			logger.debug(`Successfully saved schedule for ${day} and ${nextDay}`);
		} catch (error) {
			logger.error(`Failed to save schedule:`, error);
			throw error;
		}
	}
}
