// third party imports
import {
	HomeAssistant,
	LovelaceCard,
	LovelaceCardEditor,
} from 'custom-card-helpers';
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

// local imports
import { WEEKDAYS, WeekDay } from '../const/days';
import { EDITOR_NAME, MAIN_CARD_NAME } from '../const/element-names';
import { ITimeSlot, ITimeSlotEdit } from '../interfaces/slot.interface';
import { ScheduleManager } from '../services/schedule-manager';
import { StateManager } from '../services/state-manager';
import {
	DEFAULT_CONFIG,
	DayEntityConfig,
	DayscheduleEditorCardConfig,
} from '../types/custom-types';
import useLocalize, { TranslationKey } from '../utils/localize';
import { logger } from '../utils/logger';

// card registration
import { registerCustomCard } from '../utils/register-card';
registerCustomCard({
	type: MAIN_CARD_NAME,
	name: 'Day Schedule Editor Card',
	description: 'A card to edit daily schedules with time slots',
});

const loadSubComponents = async () => {
	try {
		// Dynamically import sub-components
		await Promise.all([
			import('../timeslot-dialog/time-slot-dialog'),
			import('../schedule-grid/schedule-grid'),
			import('../editor/dayschedule-editor-card-editor'),
		]);

		// Wait for custom elements to be defined
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
	private timeSlots: { [key: string]: ITimeSlot[] } = {};
	private scheduleManager!: ScheduleManager;
	private stateManager: StateManager = StateManager.getInstance();
	private unsubscribe?: () => void;

	private async ensureInitialized() {
		if (this.initialized) return;

		try {
			// First ensure all components are loaded
			const componentsLoaded = await loadSubComponents();
			if (!componentsLoaded) {
				throw new Error('Failed to load required components');
			}

			// Then initialize schedule manager and load data
			if (!this.scheduleManager && this.hass && this.config) {
				this.scheduleManager = new ScheduleManager(
					this.hass,
					this.config.entities
				);
				await this.loadAllSchedules();
			}

			this.initialized = true;
			logger.info('Card fully initialized');
		} catch (error) {
			logger.error('Failed to initialize card:', error);
		}
	}

	public connectedCallback() {
		super.connectedCallback();
		this.unsubscribe = this.stateManager.subscribe(
			'main-card',
			(day: WeekDay, slots: ITimeSlot[]) => {
				this.timeSlots = {
					...this.timeSlots,
					[day]: slots,
				};
				this.requestUpdate();
			}
		);
		this.ensureInitialized();
	}

	public disconnectedCallback() {
		super.disconnectedCallback();
		if (this.unsubscribe) {
			this.unsubscribe();
		}
	}

	public updated(changedProps: Map<string, any>) {
		if (changedProps.has('hass') || changedProps.has('config')) {
			this.ensureInitialized();
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

		// Nur initialisieren wenn HASS bereits verfügbar ist
		if (this.hass && !this.scheduleManager) {
			logger.debug('Config set with HASS available, initializing...');
			void this.initializeScheduleManager();
		} else {
			logger.debug('Config set but waiting for HASS...');
		}
	}

	private async initializeScheduleManager() {
		if (this.scheduleManager) {
			logger.debug('ScheduleManager already initialized, skipping');
			return;
		}

		logger.debug('Initializing ScheduleManager with HASS');
		this.scheduleManager = new ScheduleManager(this.hass, this.config.entities);

		// Nur einmal initial laden
		if (!this.initialized) {
			this.initialized = true;
			await this.loadAllSchedules();
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

	private async loadAllSchedules() {
		if (!this.hass || !this.scheduleManager) {
			logger.warn('Cannot load schedules: HASS or ScheduleManager not ready');
			return;
		}

		this.loading = true;
		try {
			const schedules = await Promise.all(
				this.days.map(async (day) => ({
					day,
					slots: await this.scheduleManager.loadSchedule(day),
				}))
			);

			// Neues Objekt erstellen um Referenz zu ändern
			this.timeSlots = schedules.reduce((acc, { day, slots }) => {
				acc[day] = [...slots];
				return acc;
			}, {} as { [key: string]: ITimeSlot[] });

			// Explizites Update anfordern
			this.requestUpdate();
		} catch (error) {
			logger.error('Failed to load schedules:', error);
		} finally {
			this.loading = false;
		}
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
		if (!this.currentDay || event.detail.type === 'cancel') {
			this.dialogOpen = false;
			this.currentSlot = null;
			this.currentDay = null;
			return;
		}

		const dayToUpdate = this.currentDay as WeekDay;
		const nextDay =
			WEEKDAYS[(WEEKDAYS.indexOf(dayToUpdate) + 1) % WEEKDAYS.length];

		try {
			let slotsToSave = [...(this.timeSlots[dayToUpdate] || [])];

			// Update slots based on action
			if (event.detail.type === 'delete') {
				const slotToDelete = event.detail.slot as ITimeSlot;
				slotsToSave = slotsToSave.filter(
					(slot) =>
						slot.start !== slotToDelete.start || slot.end !== slotToDelete.end
				);
			} else if (event.detail.type === 'edit') {
				const { oldSlot, newSlot } = event.detail.slot as ITimeSlotEdit;
				slotsToSave = slotsToSave.map((slot) =>
					slot.start === oldSlot?.start && slot.end === oldSlot?.end
						? newSlot
						: slot
				);
			} else if (event.detail.type === 'add') {
				slotsToSave = [...slotsToSave, event.detail.slot as ITimeSlot];
			}

			// Save changes
			await this.scheduleManager.saveSchedule(dayToUpdate, slotsToSave);

			// Dialog schließen
			this.dialogOpen = false;
			this.currentSlot = null;
			this.currentDay = null;

			// Update state through StateManager
			const [currentDaySlots, nextDaySlots] = await Promise.all([
				this.scheduleManager.loadSchedule(dayToUpdate),
				this.scheduleManager.loadSchedule(nextDay),
			]);

			this.stateManager.updateState(dayToUpdate, currentDaySlots);
			this.stateManager.updateState(nextDay, nextDaySlots);
		} catch (error) {
			logger.error('Failed to handle dialog action:', error);
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
