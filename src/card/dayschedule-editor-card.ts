import { LitElement, html, css } from 'lit';
import { property, customElement } from 'lit/decorators.js';
import { localize, getDefaultLanguage, abbreviateDay } from '../utils/localize';
import {
	DayEntityConfig,
	DayscheduleEditorCardConfig,
	DEFAULT_CONFIG,
} from '../types/custom-types';
import { ITimeSlot, ITimeSlotChangeEvent } from '../interfaces/slot.interface';
import { ScheduleManager } from '../services/schedule-manager';
import { translations } from '../const/translations';
import { HomeAssistant, LovelaceCard } from 'custom-card-helpers';
import { MAIN_CARD_NAME, EDITOR_NAME } from '../const/element-names';
import { logger } from '../utils/logger';
import { WEEKDAYS, WeekDay } from '../const/days';
import { mergeOverlappingSlots } from '../utils/time-utils';

@customElement(MAIN_CARD_NAME)
export class DayscheduleEditorCard extends LitElement implements LovelaceCard {
	// Add required static properties for Home Assistant
	public static getConfigElement() {
		return document.createElement(EDITOR_NAME);
	}

	public static getStubConfig() {
		return {
			type: `custom:${MAIN_CARD_NAME}`,
			entities: {
				monday: 'input_text.heating_monday',
				tuesday: 'input_text.heating_tuesday',
				wednesday: 'input_text.heating_wednesday',
				thursday: 'input_text.heating_thursday',
				friday: 'input_text.heating_friday',
				saturday: 'input_text.heating_saturday',
				sunday: 'input_text.heating_sunday',
			},
		};
	}

	@property({ attribute: false }) public hass?: HomeAssistant;
	@property() private config!: DayscheduleEditorCardConfig;
	@property() private dialogOpen = false;
	@property() private currentSlot: ITimeSlot | null = null;
	@property() private currentDay: string | null = null;
	@property() private isNewSlot = true;
	@property() private loading = true; // Add loading state
	private initialized = false;

	private readonly days: readonly WeekDay[] = WEEKDAYS;
	private timeSlots: { [key: string]: ITimeSlot[] } = {};
	private scheduleManager!: ScheduleManager;
	private translations: any;
	private language: string;

	public async connectedCallback() {
		super.connectedCallback();

		// Wait for all required custom elements to be defined
		await Promise.all([
			customElements.whenDefined('dayschedule-editor-card-grid'),
			customElements.whenDefined('dayschedule-editor-card-dialog'),
		]);

		if (!this.initialized && this.hass) {
			this.initialized = true;
			await this.loadAllSchedules();
		}
	}

	public updated(changedProps: Map<string, any>) {
		if (changedProps.has('hass')) {
			logger.debug(
				'HASS updated:',
				'available:',
				Boolean(this.hass),
				'initialized:',
				this.initialized,
				'hasScheduleManager:',
				Boolean(this.scheduleManager)
			);

			if (this.hass) {
				if (!this.scheduleManager && this.config) {
					void this.initializeScheduleManager();
				} else if (this.scheduleManager) {
					this.scheduleManager.updateHass(this.hass);
				}
			}
		}
	}

	public setConfig(config: Partial<DayscheduleEditorCardConfig>): void {
		if (!config) {
			throw new Error('Invalid configuration');
		}

		// Type guard to ensure entities exists
		if (!config.entities) {
			throw new Error('Configuration must include entities');
		}

		// Validate all required entities are provided
		const requiredDays = this.days;
		const missingEntities = requiredDays.filter(
			(day) => !(config.entities as DayEntityConfig)[day]
		);

		if (missingEntities.length > 0) {
			throw new Error(
				`Missing entity configurations for: ${missingEntities.join(', ')}`
			);
		}

		// Validate that all provided entities are input_text
		for (const day of requiredDays) {
			const entityId = config.entities[day];
			if (!entityId.startsWith('input_text.')) {
				throw new Error(
					`Entity ${entityId} for ${day} must be an input_text entity`
				);
			}
		}

		// At this point we know config.entities is complete and valid
		this.config = {
			...DEFAULT_CONFIG,
			...config,
		} as DayscheduleEditorCardConfig; // Safe to cast here as we've validated the structure

		// Initialize ScheduleManager only if we have hass
		if (this.hass) {
			logger.debug('Config set with HASS available, initializing...');
			this.initializeScheduleManager();
		} else {
			logger.debug('Config set but waiting for HASS...');
		}
	}

	private async initializeScheduleManager() {
		logger.debug('Initializing ScheduleManager with HASS');
		this.scheduleManager = new ScheduleManager(this.hass, this.config.entities);
		// wait for next render cycle to load schedules
		await new Promise((resolve) => requestAnimationFrame(resolve));
		await this.loadAllSchedules();
	}

	constructor() {
		super();
		const lang = navigator.language.split('-')[0];
		this.translations = translations[lang] || translations['en'];
		this.language = getDefaultLanguage();
	}

	private get t() {
		return (key: string) => localize(key as any, this.language);
	}

	protected async firstUpdated() {
		// Remove initial load since we'll load when hass is available
		// await this.loadAllSchedules();
	}

	private async loadAllSchedules() {
		if (!this.hass || !this.scheduleManager) {
			logger.warn('Cannot load schedules: HASS or ScheduleManager not ready');
			return;
		}

		this.loading = true; // Start loading
		try {
			logger.debug('Starting to load schedules...');
			const schedules = await Promise.all(
				this.days.map(async (day) => ({
					day,
					slots: await this.scheduleManager.loadSchedule(day),
				}))
			);

			this.timeSlots = schedules.reduce((acc, { day, slots }) => {
				acc[day] = slots;
				return acc;
			}, {} as { [key: string]: ITimeSlot[] });

			logger.debug('Successfully loaded schedules:', this.timeSlots);
		} catch (error) {
			logger.error('Failed to load schedules:', error);
		} finally {
			this.loading = false; // End loading
			this.requestUpdate();
		}
	}

	private handleTimeSlotChange(event: CustomEvent<ITimeSlotChangeEvent>) {
		// Handle schedule changes
	}

	private handleGridClick(e: CustomEvent) {
		const { day, event } = e.detail;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const y = event.clientY - rect.top;
		const hour = Math.floor((y / rect.height) * 24);
		const hourStr = hour.toString().padStart(2, '0');

		this.currentDay = day;
		this.currentSlot = {
			start: `${hourStr}:00`,
			end: `${(hour + 1).toString().padStart(2, '0')}:00`,
		};
		this.isNewSlot = true;
		this.dialogOpen = true;
	}

	private handleSlotClick(e: CustomEvent) {
		const { day, slot, event } = e.detail;
		event.stopPropagation();
		this.currentDay = day;
		this.currentSlot = { ...slot };
		this.isNewSlot = false;
		this.dialogOpen = true;
	}

	private handleAddClick(e: CustomEvent) {
		const { day, event } = e.detail;
		event.stopPropagation();

		logger.debug('Add button clicked for day:', day);

		// Force stop event bubbling
		e.stopPropagation();
		e.preventDefault();

		// Set values before dialog opens
		this.currentDay = day;
		this.currentSlot = { start: '00:00', end: '00:00' };
		this.isNewSlot = true;

		// Delay dialog opening slightly to ensure clean render
		requestAnimationFrame(() => {
			this.dialogOpen = true;
			this.requestUpdate();
		});
	}

	private async handleDialogClosed(event: CustomEvent) {
		logger.debug('Dialog closed with event:', event.detail);
		if (!this.currentDay) return;

		try {
			let updatedSlots = [...(this.timeSlots[this.currentDay] || [])];

			if (event.detail.type === 'delete') {
				updatedSlots = updatedSlots.filter(
					(slot) =>
						slot.start !== this.currentSlot?.start ||
						slot.end !== this.currentSlot?.end
				);
			} else if (
				(event.detail.type === 'add' || event.detail.type === 'edit') &&
				event.detail.slot
			) {
				if (this.isNewSlot) {
					updatedSlots = [...updatedSlots, event.detail.slot];
				} else {
					const index = updatedSlots.findIndex(
						(slot) =>
							slot.start === this.currentSlot?.start &&
							slot.end === this.currentSlot?.end
					);
					if (index >= 0) {
						updatedSlots[index] = event.detail.slot;
					}
				}
			}

			// Merge overlapping slots
			const mergedSlots = mergeOverlappingSlots(updatedSlots);

			// Update state with merged slots
			this.timeSlots = {
				...this.timeSlots,
				[this.currentDay]: mergedSlots,
			};

			// Save changes
			await this.scheduleManager.saveSchedule(this.currentDay, mergedSlots);
			logger.debug(`Saved merged slots for ${this.currentDay}:`, mergedSlots);

			// Clear dialog state
			this.dialogOpen = false;
			this.currentSlot = null;
			this.currentDay = null;

			this.requestUpdate('timeSlots');
		} catch (error) {
			logger.error('Failed to handle dialog action:', error);
		}
	}

	protected render() {
		if (!this.config || !this.hass) return html``;
		if (this.loading) return html`<div>${this.t('states.loading')}</div>`;

		const dayTranslations = this.days.reduce((acc, day) => {
			acc[day] = abbreviateDay(day, this.language);
			return acc;
		}, {} as Record<string, string>);

		logger.debug('Main render, dialog state:', {
			open: this.dialogOpen,
			currentSlot: this.currentSlot,
			currentDay: this.currentDay,
		});

		return html`
			<div class="card-content">
				<dayschedule-editor-card-grid
					.days=${this.days}
					.timeSlots=${this.timeSlots}
					.translations=${dayTranslations}
					@grid-click=${this.handleGridClick}
					@slot-click=${this.handleSlotClick}
					@add-click=${this.handleAddClick}
				></dayschedule-editor-card-grid>

				${this.dialogOpen
					? html`
							<dayschedule-editor-card-dialog
								?open=${true}
								.timeSlot=${this.currentSlot}
								.translations=${this.translations}
								.isNew=${this.isNewSlot}
								@dialog-closed=${this.handleDialogClosed}
							></dayschedule-editor-card-dialog>
					  `
					: ''}
			</div>
		`;
	}

	public getCardSize(): number {
		return 12;
	}
}

// declare types
declare global {
	interface HTMLElementTagNameMap {
		[MAIN_CARD_NAME]: DayscheduleEditorCard;
	}
}
