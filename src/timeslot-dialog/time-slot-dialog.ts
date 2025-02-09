import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';
import { ITimeSlot, ITimeSlotChangeEvent } from '../interfaces/slot.interface';
import { Translations } from '../types/custom-types';
import styles from './styles.css';
import { logger } from '../utils/logger';
import { DIALOG_NAME } from 'const/element-names';
import { customElement } from 'lit/decorators.js';

@customElement(DIALOG_NAME)
export class TimeSlotDialog extends LitElement {
	static styles = css`
		:host {
			display: none;
		}

		:host([open]) {
			display: block;
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			z-index: 1000;
		}

		.dialog-overlay {
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.6);
			z-index: 1000;
		}

		.dialog-container {
			position: relative;
			z-index: 1001;
			background: var(--card-background-color, white);
			border-radius: 8px;
			min-width: 300px;
			max-width: 400px;
			padding: 16px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
		}

		.dialog-header {
			font-size: 1.2em;
			font-weight: bold;
			margin-bottom: 16px;
		}

		.dialog-content {
			margin-bottom: 24px;
		}

		.field {
			margin-bottom: 16px;
		}

		label {
			display: block;
			margin-bottom: 8px;
		}

		input {
			width: 100%;
			padding: 8px;
			border: 1px solid var(--divider-color, #ccc);
			border-radius: 4px;
		}

		.dialog-actions {
			display: flex;
			justify-content: flex-end;
			gap: 8px;
		}

		button {
			padding: 8px 16px;
			border: none;
			border-radius: 4px;
			cursor: pointer;
		}

		.save {
			background: var(--primary-color);
			color: var(--text-primary-color, white);
		}

		.save:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		.delete {
			background: var(--error-color, red);
			color: white;
		}

		.cancel {
			background: var(--secondary-background-color);
			color: var(--primary-text-color);
		}
	`;

	@property({ type: Boolean }) open = false;
	@property({ type: Object }) timeSlot: ITimeSlot = {
		start: '00:00',
		end: '00:00',
	};
	@property({ type: Boolean }) isNew = true;
	@property({ type: Object }) translations!: Translations;

	protected firstUpdated(): void {
		// Add keyboard shortcuts
		this.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Escape') this.handleClose();
			if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) this.handleSave();
		});
	}

	private validateTimeSlot(): boolean {
		const start = new Date(`2000-01-01T${this.timeSlot.start}`);
		const end = new Date(`2000-01-01T${this.timeSlot.end}`);
		return start < end;
	}

	private handleClose(): void {
		this.dispatchEvent(
			new CustomEvent<ITimeSlotChangeEvent>('dialog-closed', {
				detail: { type: 'cancel', slot: this.timeSlot, day: '', saved: false },
			})
		);
	}

	private handleDelete(): void {
		this.dispatchEvent(
			new CustomEvent<ITimeSlotChangeEvent>('dialog-closed', {
				detail: { type: 'delete', slot: this.timeSlot, day: '', saved: true },
			})
		);
	}

	private handleSave(): void {
		if (!this.validateTimeSlot()) {
			logger.warn('Invalid time slot configuration');
			return;
		}

		logger.debug('Saving time slot:', this.timeSlot);
		this.dispatchEvent(
			new CustomEvent<ITimeSlotChangeEvent>('dialog-closed', {
				detail: {
					type: this.isNew ? 'add' : 'edit',
					slot: this.timeSlot,
					day: '',
					saved: true,
				},
				bubbles: true,
				composed: true,
			})
		);
	}

	private updateField(field: keyof ITimeSlot, value: string): void {
		logger.debug(`Updating ${field} to ${value}`);
		this.timeSlot = {
			...this.timeSlot,
			[field]: value,
		};
		this.requestUpdate();
	}

	protected render() {
		if (!this.open) {
			return null;
		}

		logger.debug('Rendering dialog with current timeSlot:', this.timeSlot);

		return html`
			<div class="dialog-overlay" @click=${this.handleClose}>
				<div
					class="dialog-container"
					@click=${(e: Event) => e.stopPropagation()}
				>
					<div class="dialog-header">
						${this.isNew ? this.translations.add : this.translations.edit}
					</div>
					<div class="dialog-content">
						<div class="field">
							<label>${this.translations.start_time}</label>
							<input
								type="time"
								.value=${this.timeSlot.start}
								@change=${(e: Event) =>
									this.updateField(
										'start',
										(e.target as HTMLInputElement).value
									)}
							/>
						</div>
						<div class="field">
							<label>${this.translations.end_time}</label>
							<input
								type="time"
								.value=${this.timeSlot.end}
								@change=${(e: Event) =>
									this.updateField('end', (e.target as HTMLInputElement).value)}
							/>
						</div>
					</div>
					<div class="dialog-actions">
						<button class="cancel" @click=${this.handleClose}>
							${this.translations.cancel}
						</button>
						${!this.isNew
							? html`
									<button class="delete" @click=${this.handleDelete}>
										${this.translations.delete}
									</button>
							  `
							: ''}
						<button
							class="save"
							?disabled=${!this.validateTimeSlot()}
							@click=${this.handleSave}
						>
							${this.translations.save}
						</button>
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
