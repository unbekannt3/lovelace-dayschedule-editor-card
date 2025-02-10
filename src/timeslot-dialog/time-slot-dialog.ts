import { HomeAssistant } from 'custom-card-helpers';
import { LitElement, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { logger } from 'utils/logger';
import { DIALOG_NAME } from '../const/element-names';
import { ITimeSlot, ITimeSlotChangeEvent } from '../interfaces/slot.interface';
import { StateManager } from '../services/state-manager';
import useLocalize from '../utils/localize';
import styles from './styles.scss';

@customElement(DIALOG_NAME)
export class TimeSlotDialog extends LitElement {
	static styles = unsafeCSS(styles);

	@property({ type: Boolean }) open = false;
	@property({ type: Object }) timeSlot: ITimeSlot = {
		start: '00:00',
		end: '00:00',
	};
	@property({ type: Boolean }) isNew = true;
	@property({ attribute: false }) public hass?: HomeAssistant;
	@property({ type: Boolean }) private isLoading = false;
	@property({ type: String }) private loadingAction: 'save' | 'delete' | null =
		null;
	@property({ type: Object }) private originalSlot: ITimeSlot | null = null;
	@property({ type: String }) private _startTime = '00:00';
	@property({ type: String }) private _endTime = '00:00';
	private currentSlot: ITimeSlot = { start: '00:00', end: '00:00' };
	private stateManager: StateManager = StateManager.getInstance();
	private unsubscribe?: () => void;

	connectedCallback() {
		super.connectedCallback();
		this.unsubscribe = this.stateManager.subscribe('time-slot-dialog', () => {
			// Dialog braucht nur ein Update wenn sich der aktuelle Slot ändert
			if (this.currentSlot) {
				this.requestUpdate();
			}
		});
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		if (this.unsubscribe) {
			this.unsubscribe();
		}
	}

	protected firstUpdated(): void {
		// Add keyboard shortcuts
		this.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Escape') this.handleClose();
			if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) this.handleSave();
		});

		// Speichern des ursprünglichen Slots für späteren Vergleich
		if (!this.isNew) {
			this.originalSlot = { ...this.timeSlot };
		}
	}

	protected willUpdate(changedProps: Map<string, unknown>): void {
		if (changedProps.has('timeSlot')) {
			// Nur beim ersten Setzen kopieren
			if (!this.currentSlot || this.currentSlot.start === '00:00') {
				this.currentSlot = { ...this.timeSlot };
			}
			if (!this.isNew) {
				this.originalSlot = { ...this.timeSlot };
			}
		}
	}

	private validateTimeSlot(): boolean {
		const [startHours, startMinutes] = this.currentSlot.start
			.split(':')
			.map(Number);
		const [endHours, endMinutes] = this.currentSlot.end.split(':').map(Number);

		const startMinutesTotal = startHours * 60 + startMinutes;
		let endMinutesTotal = endHours * 60 + endMinutes;

		// Wenn die Endzeit kleiner ist als die Startzeit, füge 24h hinzu
		if (endMinutesTotal < startMinutesTotal) {
			endMinutesTotal += 24 * 60;
		}

		// Zeitslots müssen mindestens 1 Minute lang sein
		return endMinutesTotal > startMinutesTotal;
	}

	private handleClose(): void {
		if (this.loadingAction) return; // Prevent closing while action is in progress

		this.dispatchEvent(
			new CustomEvent<ITimeSlotChangeEvent>('dialog-closed', {
				detail: { type: 'cancel', slot: this.timeSlot, day: '', saved: false },
			})
		);
	}

	private async handleDelete(): Promise<void> {
		if (this.loadingAction) return;

		try {
			this.loadingAction = 'delete';
			await new Promise<void>((resolve) => {
				this.dispatchEvent(
					new CustomEvent<ITimeSlotChangeEvent>('dialog-closed', {
						detail: {
							type: 'delete',
							slot: this.originalSlot || this.timeSlot,
							day: '',
							saved: true,
						},
					})
				);
				resolve();
			});
		} catch (error) {
			this.loadingAction = null;
			logger.error('Delete failed:', error);
		}
	}

	private async handleSave(): Promise<void> {
		if (!this.validateTimeSlot() || this.loadingAction) return;

		this.loadingAction = 'save';
		try {
			// Event auslösen und auf Verarbeitung warten
			await new Promise<void>((resolve) => {
				this.dispatchEvent(
					new CustomEvent<ITimeSlotChangeEvent>('dialog-closed', {
						detail: {
							type: this.isNew ? 'add' : 'edit',
							slot: this.isNew
								? this.currentSlot
								: {
										oldSlot: this.originalSlot,
										newSlot: this.currentSlot,
								  },
							day: '',
							saved: true,
						},
						bubbles: true,
						composed: true,
					})
				);
				resolve();
			});
		} catch (error) {
			this.loadingAction = null;
			logger.error('Save failed:', error);
		}
	}

	private updateTime(type: 'start' | 'end', value: string): void {
		this.currentSlot = {
			...this.currentSlot,
			[type]: value,
		};
		this.requestUpdate();
	}

	private handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
			e.preventDefault(); // Verhindert natives Form-Submit
			if (this.validateTimeSlot()) {
				this.handleSave();
			}
		} else if (e.key === 'Escape') {
			this.handleClose();
		}
	}

	protected updated(changedProps: Map<string, unknown>): void {
		if (changedProps.has('timeSlot')) {
			// Inputs manuell aktualisieren
			const inputs = this.shadowRoot?.querySelectorAll('input');
			inputs?.forEach((input) => {
				const field = input.getAttribute('data-field') as keyof ITimeSlot;
				if (field) {
					input.value = this.timeSlot[field];
				}
			});
		}
	}

	private renderButton(type: 'save' | 'delete' | 'cancel') {
		const getTranslation = useLocalize(this.hass);
		const isLoading = this.loadingAction === type;
		const icons = {
			save: this.isNew ? 'mdi:plus' : 'mdi:content-save',
			delete: 'mdi:delete-outline',
			cancel: 'mdi:close',
		};

		return html`
			<button
				class="${type}"
				@click=${type === 'save'
					? this.handleSave
					: type === 'delete'
					? this.handleDelete
					: this.handleClose}
				?disabled=${!!this.loadingAction}
				data-loading=${isLoading}
			>
				<div class="button-content">
					<ha-icon .icon=${icons[type]}></ha-icon>
					${getTranslation(`actions.${type}`)}
				</div>
				${isLoading
					? html`
							<div class="loading-overlay">
								<span class="spinner"></span>
							</div>
					  `
					: ''}
			</button>
		`;
	}

	protected render() {
		if (!this.open) return null;

		const getTranslation = useLocalize(this.hass);

		return html`
			<div class="dialog-overlay" @click=${this.handleClose}>
				<div
					class="dialog-container"
					@click=${(e: Event) => e.stopPropagation()}
				>
					<div class="dialog-header">
						${getTranslation(this.isNew ? 'timeslot.add' : 'timeslot.edit')}
					</div>
					<div class="dialog-content">
						<div class="field">
							<label>${getTranslation('fields.start_time')}</label>
							<input
								type="time"
								.value=${this.currentSlot.start}
								@keydown=${this.handleKeyDown}
								@change=${(e: Event) =>
									this.updateTime(
										'start',
										(e.target as HTMLInputElement).value
									)}
							/>
						</div>
						<div class="field">
							<label>${getTranslation('fields.end_time')}</label>
							<input
								type="time"
								.value=${this.currentSlot.end}
								@keydown=${this.handleKeyDown}
								@change=${(e: Event) =>
									this.updateTime('end', (e.target as HTMLInputElement).value)}
							/>
						</div>
					</div>
					<div class="dialog-actions">
						${this.renderButton('cancel')}
						${!this.isNew ? this.renderButton('delete') : ''}
						${this.renderButton('save')}
					</div>
				</div>
			</div>
		`;
	}
}

customElements.get(DIALOG_NAME) ||
	customElements.define(DIALOG_NAME, TimeSlotDialog);

declare global {
	interface HTMLElementTagNameMap {
		[DIALOG_NAME]: TimeSlotDialog;
	}
}
