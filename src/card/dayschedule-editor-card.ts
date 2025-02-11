// third party imports
import {
	HomeAssistant,
	LovelaceCard,
	LovelaceCardEditor,
} from 'custom-card-helpers';
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Subscription } from 'rxjs';

// local imports
import { ETimeSlotType } from 'enums/slot.enum';
import { StateManager } from 'services/state-manager';
import { WEEKDAYS, WeekDay } from '../const/days';
import { EDITOR_NAME, MAIN_CARD_NAME } from '../const/element-names';
import { ITimeSlot, ITimeSlotEdit } from '../interfaces/slot.interface';
import { HADataService } from '../services/ha-data.service';
import { ScheduleStore } from '../store/schedule.store';
import {
	DEFAULT_CONFIG,
	DayEntityConfig,
	DayscheduleEditorCardConfig,
} from '../types/custom-types';
import useLocalize, { TranslationKey } from '../utils/localize';
import { logger } from '../utils/logger';
import { registerCustomCard } from '../utils/register-card';

// card registration
registerCustomCard({
	type: MAIN_CARD_NAME,
	name: 'Day Schedule Editor Card',
	description: 'A card to edit daily schedules with time slots',
});

const loadSubComponents = async () => {
	try {
		// Warte zuerst auf HA Core-Komponenten
		await Promise.all([
			customElements.whenDefined('hui-view'),
			customElements.whenDefined('home-assistant-main'),
		]);

		// Dann lade unsere Komponenten
		const imports = await Promise.all([
			import('../timeslot-dialog/time-slot-dialog'),
			import('../schedule-grid/schedule-grid'),
			import('../editor/dayschedule-editor-card-editor'),
		]);

		// Warte auf Definition unserer Komponenten
		await Promise.all([
			customElements.whenDefined('dayschedule-editor-card-dialog'),
			customElements.whenDefined('dayschedule-editor-card-grid'),
			customElements.whenDefined('dayschedule-editor-card-editor'),
		]);

		logger.debug('All sub-components loaded successfully');
		return true;
	} catch (error) {
		logger.error('Failed to load sub-components:', error);
		return false;
	}
};

@customElement(MAIN_CARD_NAME)
export class DayscheduleEditorCard extends LitElement implements LovelaceCard {
	// Add required static properties for Home Assistant
	public static async getConfigElement() {
		await loadSubComponents();
		return document.createElement(EDITOR_NAME) as LovelaceCardEditor;
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
	@property() private loading = true;
	private initialized = false;

	private readonly days: readonly WeekDay[] = WEEKDAYS;
	private timeSlots: { [key: string]: ITimeSlot[] | undefined } = {};
	private stateManager: StateManager = StateManager.getInstance();

	private store = ScheduleStore.getInstance();
	private haService = HADataService.getInstance();
	private subscription?: Subscription;

	private initializationPromise: Promise<void> | null = null;

	private async ensureInitialized() {
		if (!this.initializationPromise) {
			this.initializationPromise = (async () => {
				if (this.initialized) return;

				try {
					const componentsLoaded = await loadSubComponents();
					if (!componentsLoaded) {
						throw new Error('Failed to load components');
					}

					if (this.hass && this.config) {
						this.haService.initialize(this.hass, this.config.entities);
						await this.store.initialize();
					}

					this.initialized = true;
					this.loading = false;
					logger.info('Card fully initialized');
				} catch (error) {
					logger.error('Failed to initialize card:', error);
					this.loading = false;
					this.initializationPromise = null;
				}
			})();
		}
		return this.initializationPromise;
	}

	public connectedCallback() {
		super.connectedCallback();
		if (!this.subscription) {
			this.subscription = this.store.getAllSlots$().subscribe((slots) => {
				this.timeSlots = Object.entries(slots).reduce((acc, [key, value]) => {
					acc[key] = value || [];
					return acc;
				}, {} as { [key: string]: ITimeSlot[] });

				this.requestUpdate();
			});
		}
		void this.ensureInitialized();
	}

	public disconnectedCallback() {
		super.disconnectedCallback();
		this.subscription?.unsubscribe();
	}

	public updated(changedProps: Map<string, any>) {
		if (
			(changedProps.has('hass') || changedProps.has('config')) &&
			this.hass &&
			this.config
		) {
			void this.ensureInitialized();
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

		if (this.hass) {
			logger.debug('Config set with HASS available, initializing...');
			void this.ensureInitialized();
		} else {
			logger.debug('Config set but waiting for HASS...');
		}
	}

	constructor() {
		super();
	}

	private getTranslation(key: TranslationKey): string {
		return useLocalize(this.hass)(key);
	}

	protected async firstUpdated() {
		await this.ensureInitialized();
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
		if (!this.currentDay || event.detail.type === ETimeSlotType.CANCEL) {
			this.dialogOpen = false;
			this.currentSlot = null;
			this.currentDay = null;
			return;
		}

		const dayToUpdate = this.currentDay as WeekDay;

		try {
			let slotsToSave = [...(this.timeSlots[dayToUpdate] || [])];

			// Update slots based on action
			if (event.detail.type === ETimeSlotType.DELETE) {
				const slotToDelete = event.detail.slot as ITimeSlot;
				slotsToSave = slotsToSave.filter(
					(slot) =>
						slot.start !== slotToDelete.start || slot.end !== slotToDelete.end
				);
			} else if (event.detail.type === ETimeSlotType.EDIT) {
				const { oldSlot, newSlot } = event.detail.slot as ITimeSlotEdit;
				slotsToSave = slotsToSave.map((slot) =>
					slot.start === oldSlot?.start && slot.end === oldSlot?.end
						? newSlot
						: slot
				);
			} else if (event.detail.type === ETimeSlotType.ADD) {
				slotsToSave = [...slotsToSave, event.detail.slot as ITimeSlot];
			}

			// Save via store
			await this.store.updateSlots(dayToUpdate, slotsToSave);

			// Close dialog after successful save
			this.dialogOpen = false;
			this.currentSlot = null;
			this.currentDay = null;
		} catch (error) {
			logger.error('Failed to handle dialog action:', error);
			// Dialog bleibt bei Fehler offen
		}
	}

	private async handleSlotResize(e: CustomEvent) {
		const { day, oldSlot, newSlot, final } = e.detail;
		logger.debug('Resize event received:', { day, oldSlot, newSlot, final });

		if (day && oldSlot && newSlot) {
			try {
				const slots = [...(this.timeSlots[day] || [])];
				const index = slots.findIndex(
					(s) => s.start === oldSlot.start && s.end === oldSlot.end
				);

				if (index !== -1) {
					slots[index] = newSlot;

					if (final) {
						logger.debug('Processing final resize:', {
							day,
							slots,
							oldSlot,
							newSlot,
							final: true,
						});

						// Sicherstellen, dass das finale Update tatsächlich in HA gespeichert wird
						await this.store.updateSlots(day as WeekDay, slots, true);
						logger.debug('Final resize saved to HA');
					} else {
						logger.debug('Processing interim resize');
						await this.store.updateLocalState(day as WeekDay, slots);
					}
				}
			} catch (error) {
				logger.error('Error handling resize:', error);
			}
		}
	}

	protected render() {
		if (!this.config || !this.hass) return html``;
		if (this.loading)
			return html`<div>${this.getTranslation('states.loading')}</div>`;

		const dayTranslations = this.days.reduce((acc, day) => {
			acc[day] = this.getTranslation(`daysShort.${day}` as TranslationKey);
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
					@slot-resize=${this.handleSlotResize}
					@add-click=${this.handleAddClick}
				></dayschedule-editor-card-grid>

				${this.dialogOpen
					? html`
							<dayschedule-editor-card-dialog
								?open=${true}
								.hass=${this.hass}
								.timeSlot=${this.currentSlot}
								.translations=${{
									add: this.getTranslation('actions.add'),
									edit: this.getTranslation('actions.edit'),
									delete: this.getTranslation('actions.delete'),
									cancel: this.getTranslation('actions.cancel'),
									save: this.getTranslation('actions.save'),
									start_time: this.getTranslation('fields.start_time'),
									end_time: this.getTranslation('fields.end_time'),
								}}
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
