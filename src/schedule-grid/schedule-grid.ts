import { LitElement, css, html } from 'lit';
import { property } from 'lit/decorators.js';
import { ITimeSlot } from '../interfaces/slot.interface';
import styles from '../card/styles.css';
import { logger } from '../utils/logger';
import { GRID_NAME } from 'const/element-names';

export class ScheduleGrid extends LitElement {
	@property({ type: Array }) days: string[] = [];
	@property({ type: Object }) timeSlots: { [key: string]: ITimeSlot[] } = {};
	@property({ type: Object }) translations: { [key: string]: string } = {};

	static styles = css`
		:host {
			display: block;
			position: relative;
			min-height: 600px;
			height: 100%;
		}

		.grid-layout {
			display: flex;
			flex-direction: column;
			height: 100%;
			min-height: 600px;
			position: relative;
		}

		.day-headers {
			display: flex;
			padding-left: 60px;
			flex: 0 0 auto;
			position: sticky;
			top: 0;
			z-index: 2;
			background: var(--card-background-color);
		}

		.day-header {
			flex: 1;
			text-align: center;
			font-weight: bold;
			padding: 8px 4px;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.schedule-grid {
			display: flex;
			flex: 1;
			min-height: 600px;
			border: 1px solid var(--divider-color);
			border-radius: 4px;
			margin: 8px 0;
			position: relative;
			overflow: hidden;
		}

		.time-column {
			flex: 0 0 60px;
			border-right: 1px solid var(--divider-color);
			background: var(--card-background-color);
			position: sticky;
			left: 0;
			z-index: 1;
		}

		.day-columns {
			display: flex;
			flex: 1;
			position: relative;
		}

		.day-column {
			flex: 1;
			position: relative;
			border-right: 1px solid var(--divider-color);
			min-height: 600px;
			height: 600px; /* Feste Höhe für korrekte Berechnungen */
		}

		.add-buttons-container {
			display: flex;
			padding-left: 60px;
			margin-top: 8px;
			flex: 0 0 auto;
			position: sticky;
			bottom: 0;
			z-index: 2;
			background: var(--card-background-color);
		}

		.add-button {
			flex: 1;
			margin: 0 4px;
			padding: 8px;
			border: 1px dashed var(--primary-color);
			border-radius: 4px;
			text-align: center;
			cursor: pointer;
			background: var(--card-background-color);
		}

		.add-button:hover {
			background: var(--primary-color);
			color: var(--text-primary-color);
		}

		.time-slot {
			position: absolute;
			left: 4px;
			right: 4px;
			background: var(--primary-color);
			color: var(--text-primary-color);
			border-radius: 4px;
			padding: 4px;
			font-size: 0.8em;
			cursor: pointer;
			z-index: 1;
			min-height: 20px; /* Minimale Höhe für bessere Lesbarkeit */
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			text-align: center;
			line-height: 1.2;
		}

		.time-slot-time {
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			width: 100%;
		}
	`;

	private calculatePosition(time: string): number {
		const [hours, minutes] = time.split(':').map(Number);
		const totalMinutes = hours * 60 + minutes;
		return (totalMinutes / (24 * 60)) * 100;
	}

	private calculateHeight(start: string, end: string): number {
		const [startHours, startMinutes] = start.split(':').map(Number);
		const [endHours, endMinutes] = end.split(':').map(Number);
		const startTotalMinutes = startHours * 60 + startMinutes;
		const endTotalMinutes = endHours * 60 + endMinutes;
		const duration = endTotalMinutes - startTotalMinutes;
		return (duration / (24 * 60)) * 100;
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
							(_, i) => html` <div style="height: 25px;">${i}:00</div> `
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
		const top = this.calculatePosition(slot.start);
		const height = this.calculateHeight(slot.start, slot.end);
		return html`
			<div
				class="time-slot"
				style="top: ${top}%; height: ${height}%;"
				@click=${(e: MouseEvent) => {
					e.stopPropagation();
					this.dispatchEvent(
						new CustomEvent('slot-click', {
							detail: { day, slot, event: e },
						})
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
