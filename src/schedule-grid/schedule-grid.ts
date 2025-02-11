import { LitElement, html, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';
import { Subscription } from 'rxjs';
import { WeekDay } from '../const/days';
import { GRID_NAME } from '../const/element-names';
import { ITimeSlot } from '../interfaces/slot.interface';
import { StateManager } from '../services/state-manager';
import { ScheduleStore } from '../store/schedule.store';
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
	timeSlots: { [key: string]: ITimeSlot[] | undefined } = {};

	@property({ type: Object }) translations: { [key: string]: string } = {};

	private readonly HOUR_HEIGHT = 25; // height of one hour in pixels
	private readonly TOTAL_HOURS = 24;
	private readonly GRID_HEIGHT = this.HOUR_HEIGHT * this.TOTAL_HOURS;
	private readonly SLOT_OFFSET = 6; // pixel offset for match height with time labels
	private readonly END_ADJUSTMENT = 10; // pixel adjustment for slots that end at 23:59

	private stateManager: StateManager = StateManager.getInstance();
	private unsubscribe?: () => void;
	private store = ScheduleStore.getInstance();
	private subscription?: Subscription;
	private isResizing = false; // New flag for the entire grid

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

	private async updateTimeSlots(day: WeekDay, slots: ITimeSlot[]) {
		const newTimeSlots = Object.entries(this.timeSlots).reduce(
			(acc, [key, value]) => {
				acc[key] = value ? [...value] : [];
				return acc;
			},
			{} as { [key: string]: ITimeSlot[] }
		);

		newTimeSlots[day] = slots.map((slot) => ({ ...slot }));
		this.timeSlots = newTimeSlots;

		// Force multiple updates
		this.requestUpdate();
		await this.updateComplete;
		requestAnimationFrame(() => {
			this.requestUpdate();
			this.updateComplete.then(() => {
				requestAnimationFrame(() => this.requestUpdate());
			});
		});
	}

	connectedCallback() {
		super.connectedCallback();
		this.unsubscribe = this.stateManager.subscribe(
			'schedule-grid',
			(day: WeekDay, slots: ITimeSlot[]) => {
				this.updateTimeSlots(day, slots);
			}
		);
		this.subscription = this.store.getAllSlots$().subscribe((slots) => {
			// Ensure we have arrays for all days
			const validSlots = Object.entries(slots).reduce((acc, [key, value]) => {
				acc[key] = value || [];
				return acc;
			}, {} as { [key: string]: ITimeSlot[] });

			this.timeSlots = validSlots;
			this.requestUpdate();
			// Force multiple updates for reliable rendering
			requestAnimationFrame(() => {
				this.requestUpdate();
			});
		});
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		if (this.unsubscribe) {
			this.unsubscribe();
		}
		this.subscription?.unsubscribe();
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
									@click=${(e: MouseEvent) => this.handleGridClick(e, day)}
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

	private roundToNearestInterval(
		hours: number,
		intervalMinutes: number = 5
	): number {
		const totalMinutes = hours * 60;
		const roundedMinutes =
			Math.round(totalMinutes / intervalMinutes) * intervalMinutes;
		return roundedMinutes / 60;
	}

	private handleResizeStart(
		e: MouseEvent,
		day: string,
		slot: ITimeSlot,
		handle: 'top' | 'bottom'
	) {
		e.stopPropagation();
		e.preventDefault();
		this.isResizing = true;

		const startY = e.clientY;
		const startSlot = { ...slot };
		let currentSlot = { ...slot };
		let lastDispatchTime = Date.now();

		const onMouseMove = (moveEvent: MouseEvent) => {
			moveEvent.preventDefault();
			moveEvent.stopPropagation();

			const deltaY = moveEvent.clientY - startY;
			const deltaHours = deltaY / this.HOUR_HEIGHT;
			let newSlot: ITimeSlot;

			if (handle === 'top') {
				const newStartHour = this.roundToNearestInterval(
					Math.max(
						0,
						Math.min(23, this.timeToHours(startSlot.start) + deltaHours)
					)
				);
				newSlot = {
					start: this.hoursToTime(newStartHour),
					end: startSlot.end,
				};
			} else {
				const newEndHour = this.roundToNearestInterval(
					Math.max(
						0,
						Math.min(24, this.timeToHours(startSlot.end) + deltaHours)
					)
				);
				newSlot = {
					start: startSlot.start,
					end: newEndHour === 24 ? '23:59' : this.hoursToTime(newEndHour),
				};
			}

			if (
				newSlot.start !== currentSlot.start ||
				newSlot.end !== currentSlot.end
			) {
				currentSlot = { ...newSlot };
				this.dispatchEvent(
					new CustomEvent('slot-resize', {
						detail: { day, oldSlot: startSlot, newSlot, final: false },
					})
				);
			}
		};

		const onMouseUp = (upEvent: MouseEvent) => {
			upEvent.preventDefault();
			upEvent.stopPropagation();

			// Cleanup listeners first
			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mouseup', onMouseUp);

			// Ensure final update is processed before resetting state
			setTimeout(() => {
				// Dispatch final event
				this.dispatchEvent(
					new CustomEvent('slot-resize', {
						detail: {
							day,
							oldSlot: startSlot,
							newSlot: currentSlot,
							final: true,
						},
						bubbles: true,
						composed: true,
						cancelable: true,
					})
				);

				// Reset resize state after event dispatch
				setTimeout(() => {
					this.isResizing = false;
				}, 100);
			}, 0);
		};

		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	}

	private handleGridClick(e: MouseEvent, day: string) {
		// Only handle click if we weren't just resizing
		if (!this.isResizing) {
			this.dispatchEvent(
				new CustomEvent('grid-click', {
					detail: { day, event: e },
				})
			);
		}
	}

	private async handleSlotClick(e: MouseEvent, day: string, slot: ITimeSlot) {
		// Check if we were just resizing
		if (!this.isResizing) {
			e.stopPropagation();
			this.dispatchEvent(
				new CustomEvent('slot-click', {
					detail: { day, slot, event: e },
					bubbles: true,
					composed: true,
				})
			);
		}
	}

	private timeToHours(time: string): number {
		const [hours, minutes] = time.split(':').map(Number);
		return hours + minutes / 60;
	}

	private hoursToTime(hours: number): string {
		const h = Math.floor(hours);
		const m = Math.round((hours - h) * 60);
		return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
	}

	private renderTimeSlot(day: string, slot: ITimeSlot) {
		const topPx = this.calculatePosition(slot.start);
		const heightPx = this.calculateHeight(slot.start, slot.end);

		return html`
			<div
				class="time-slot"
				style="top: ${topPx}px; height: ${heightPx}px;"
				@click=${(e: MouseEvent) => {
					// Auch für Klicks auf Text-Elemente den Slot bearbeiten
					const isHandle = (e.target as HTMLElement).classList.contains(
						'resize-handle'
					);
					if (!isHandle) {
						e.stopPropagation();
						this.handleSlotClick(e, day, slot);
					}
				}}
			>
				<div
					class="resize-handle top"
					@mousedown=${(e: MouseEvent) =>
						this.handleResizeStart(e, day, slot, 'top')}
					@click=${(e: MouseEvent) => e.stopPropagation()}
				></div>
				<span class="time-slot-time">${slot.start}</span>
				<span class="time-slot-time">${slot.end}</span>
				<div
					class="resize-handle bottom"
					@mousedown=${(e: MouseEvent) =>
						this.handleResizeStart(e, day, slot, 'bottom')}
					@click=${(e: MouseEvent) => e.stopPropagation()}
				></div>
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
