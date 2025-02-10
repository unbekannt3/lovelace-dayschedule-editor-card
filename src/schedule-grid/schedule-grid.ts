import { LitElement, html, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';
import { WeekDay } from '../const/days';
import { GRID_NAME } from '../const/element-names';
import { ITimeSlot } from '../interfaces/slot.interface';
import { StateManager } from '../services/state-manager';
import styles from './styles.scss';

export class ScheduleGrid extends LitElement {
	static styles = unsafeCSS(styles);

	@property({
		type: Array,
		hasChanged: (newVal: unknown, oldVal: unknown) => true,
	})
	days: string[] = [];

	@property({
		type: Object,
		hasChanged: () => true,
	})
	timeSlots: { [key: string]: ITimeSlot[] } = {};

	@property({ type: Object }) translations: { [key: string]: string } = {};

	private readonly HOUR_HEIGHT = 25; // height of one hour in pixels
	private readonly TOTAL_HOURS = 24;
	private readonly GRID_HEIGHT = this.HOUR_HEIGHT * this.TOTAL_HOURS;
	private readonly SLOT_OFFSET = 6; // pixel offset for match height with time labels
	private readonly END_ADJUSTMENT = 10; // pixel adjustment for slots that end at 23:59

	private stateManager: StateManager = StateManager.getInstance();
	private unsubscribe?: () => void;

	private calculatePosition(time: string): number {
		const [hours, minutes] = time.split(':').map(Number);
		const basePosition = (hours + minutes / 60) * this.HOUR_HEIGHT;
		// no offset for slots that start at 00:00
		return hours === 0 && minutes === 0
			? basePosition
			: basePosition + this.SLOT_OFFSET;
	}

	private calculateHeight(start: string, end: string): number {
		const startPos = this.calculatePosition(start);
		let endPos = this.calculatePosition(end);

		if (end === '23:59') {
			// adjust end position for slots that end at 23:59
			endPos = this.GRID_HEIGHT - this.END_ADJUSTMENT;
		}

		return Math.max(endPos - startPos, 20);
	}

	connectedCallback() {
		super.connectedCallback();
		this.unsubscribe = this.stateManager.subscribe(
			'schedule-grid',
			(day: WeekDay, slots: ITimeSlot[]) => {
				// Neues Objekt erstellen für bessere Reaktivität
				this.timeSlots = {
					...this.timeSlots,
					[day]: [...slots],
				};

				// Explizites Update erzwingen
				this.requestUpdate();

				// Render in der nächsten Frame
				requestAnimationFrame(() => {
					this.requestUpdate();
				});
			}
		);
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		if (this.unsubscribe) {
			this.unsubscribe();
		}
	}

	protected render() {
		return html`
			<div class="grid-layout">
				<div class="day-headers">
					${this.days.map(
						(day) => html`
							<div class="day-header">${this.translations[day]}</div>
						`
					)}
				</div>

				<div class="schedule-grid">
					<div class="time-column">
						${Array.from(
							{ length: 24 },
							(_, i) => html`
								<div class="time-label">
									${i.toString().padStart(2, '0')}:00
								</div>
							`
						)}
					</div>
					<div class="day-columns">
						${this.days.map(
							(day) => html`
								<div
									class="day-column"
									@click=${(e: MouseEvent) =>
										this.dispatchEvent(
											new CustomEvent('grid-click', {
												detail: { day, event: e },
											})
										)}
								>
									${this.timeSlots[day]?.map((slot) =>
										this.renderTimeSlot(day, slot)
									)}
								</div>
							`
						)}
					</div>
				</div>

				<div class="add-buttons-container">
					${this.days.map(
						(day) => html`
							<div
								class="add-button"
								@click=${(e: MouseEvent) =>
									this.dispatchEvent(
										new CustomEvent('add-click', {
											detail: { day, event: e },
										})
									)}
							>
								+
							</div>
						`
					)}
				</div>
			</div>
		`;
	}

	private renderTimeSlot(day: string, slot: ITimeSlot) {
		const topPx = this.calculatePosition(slot.start);
		const heightPx = this.calculateHeight(slot.start, slot.end);

		return html`
			<div
				class="time-slot"
				style="top: ${topPx}px; height: ${heightPx}px;"
				@click=${(e: MouseEvent) => {
					e.stopPropagation();
					this.dispatchEvent(
						new CustomEvent('slot-click', { detail: { day, slot, event: e } })
					);
				}}
			>
				<span class="time-slot-time">${slot.start}</span>
				<span class="time-slot-time">${slot.end}</span>
			</div>
		`;
	}
}

customElements.get(GRID_NAME) || customElements.define(GRID_NAME, ScheduleGrid);

declare global {
	interface HTMLElementTagNameMap {
		[GRID_NAME]: ScheduleGrid;
	}
}
