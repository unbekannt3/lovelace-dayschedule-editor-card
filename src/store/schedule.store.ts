import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { logger } from 'utils/logger';
import { WeekDay, WEEKDAYS } from '../const/days';
import { ITimeSlot } from '../interfaces/slot.interface';
import { HADataService } from '../services/ha-data.service';
import { mergeOverlappingSlots } from '../utils/time-utils';

interface DialogState {
	currentSlot: ITimeSlot | null;
	isOpen: boolean;
}

interface ScheduleState {
	slots: { [key in WeekDay]?: ITimeSlot[] };
	loading: boolean;
	dialog: DialogState;
}

export class ScheduleStore {
	private static instance: ScheduleStore;
	private state$ = new BehaviorSubject<ScheduleState>({
		slots: {},
		loading: false,
		dialog: {
			currentSlot: null,
			isOpen: false,
		},
	});
	private haService = HADataService.getInstance();
	private initPromise: Promise<void> | null = null;

	private constructor() {
		this.setupHAListener();
	}

	public static getInstance(): ScheduleStore {
		if (!ScheduleStore.instance) {
			ScheduleStore.instance = new ScheduleStore();
		}
		return ScheduleStore.instance;
	}

	private setupHAListener(): void {
		this.haService.onStateChange((day, value) => {
			const slots = this.parseScheduleString(value);
			this.updateState(day, slots);
		});
	}

	private parseScheduleString(value: string): ITimeSlot[] {
		if (!value) return [];
		return value.split(';').map((slot) => {
			const [start, end] = slot.split('-');
			return { start: start.trim(), end: end.trim() };
		});
	}

	public getSlots$(day: WeekDay): Observable<ITimeSlot[]> {
		return this.state$.pipe(map((state) => state.slots[day] || []));
	}

	public getAllSlots$(): Observable<{ [key in WeekDay]?: ITimeSlot[] }> {
		return this.state$.pipe(map((state) => state.slots));
	}

	public getDialogState$(): Observable<DialogState> {
		return this.state$.pipe(map((state) => state.dialog));
	}

	public updateDialogState(dialogState: Partial<DialogState>): void {
		const currentState = this.state$.value;
		this.state$.next({
			...currentState,
			dialog: {
				...currentState.dialog,
				...dialogState,
			},
		});
	}

	private updateState(day: WeekDay, slots: ITimeSlot[]): void {
		const currentState = this.state$.value;
		const mergedSlots = mergeOverlappingSlots(slots);

		this.state$.next({
			...currentState,
			slots: {
				...currentState.slots,
				[day]: mergedSlots,
			},
		});
	}

	private isCrossDaySlot(slot: ITimeSlot): boolean {
		const [startHours, startMinutes] = slot.start.split(':').map(Number);
		const [endHours, endMinutes] = slot.end.split(':').map(Number);
		const startTotal = startHours * 60 + startMinutes;
		const endTotal = endHours * 60 + endMinutes;
		return endTotal < startTotal;
	}

	private splitCrossDaySlot(slot: ITimeSlot): {
		current: ITimeSlot;
		next: ITimeSlot;
	} {
		return {
			current: { start: slot.start, end: '23:59' },
			next: { start: '00:00', end: slot.end },
		};
	}

	private getNextDay(day: WeekDay): WeekDay {
		const index = WEEKDAYS.indexOf(day);
		return WEEKDAYS[(index + 1) % WEEKDAYS.length];
	}

	private updateStateWithoutSave(day: WeekDay, slots: ITimeSlot[]): void {
		const currentState = this.state$.value;
		const mergedSlots = mergeOverlappingSlots(slots);

		this.state$.next({
			...currentState,
			slots: {
				...currentState.slots,
				[day]: mergedSlots,
			},
		});
	}

	public async updateSlots(
		day: WeekDay,
		slots: ITimeSlot[],
		saveToHA: boolean = true
	): Promise<void> {
		try {
			logger.debug('UpdateSlots called:', { day, slots, saveToHA });

			const currentDaySlots: ITimeSlot[] = [];
			const nextDaySlots: ITimeSlot[] = [];

			slots.forEach((slot) => {
				if (this.isCrossDaySlot(slot)) {
					const { current, next } = this.splitCrossDaySlot(slot);
					currentDaySlots.push(current);
					nextDaySlots.push(next);
				} else {
					currentDaySlots.push(slot);
				}
			});

			const nextDay = this.getNextDay(day);
			const existingNextDaySlots = this.state$.value.slots[nextDay] || [];
			const mergedNextDaySlots = mergeOverlappingSlots([
				...existingNextDaySlots.filter((slot) => slot.start !== '00:00'),
				...nextDaySlots,
			]);

			const mergedCurrentDaySlots = mergeOverlappingSlots(currentDaySlots);

			logger.debug('Before state update:', {
				currentDay: day,
				currentSlots: mergedCurrentDaySlots,
				nextDay,
				nextDaySlots: mergedNextDaySlots,
				saveToHA,
			});

			// Update local state first
			this.state$.next({
				...this.state$.value,
				slots: {
					...this.state$.value.slots,
					[day]: mergedCurrentDaySlots,
					[nextDay]: mergedNextDaySlots,
				},
			});

			// Then save to HA if needed
			if (saveToHA) {
				logger.debug('Attempting HA save for:', {
					day,
					slots: mergedCurrentDaySlots,
				});

				try {
					await Promise.all([
						this.haService.saveSchedule(day, mergedCurrentDaySlots),
						mergedNextDaySlots.length > 0
							? this.haService.saveSchedule(nextDay, mergedNextDaySlots)
							: Promise.resolve(),
					]);
					logger.debug('Successfully saved to HA');
				} catch (error) {
					logger.error('HA save failed:', error);
					throw error;
				}
			}
		} catch (error) {
			logger.error('Failed to update slots:', error);
			throw error;
		}
	}

	public updateLocalState(day: WeekDay, slots: ITimeSlot[]): void {
		// Nur lokales Update ohne HA Speicherung
		void this.updateSlots(day, slots, false);
	}

	public async initialize(): Promise<void> {
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = (async () => {
			if (
				this.state$.value.slots &&
				Object.keys(this.state$.value.slots).length
			) {
				logger.debug('Store already initialized, skipping');
				return;
			}

			logger.debug('Initializing store');
			const initialSlots: { [key in WeekDay]?: ITimeSlot[] } = {};

			try {
				await Promise.all(
					WEEKDAYS.map(async (day) => {
						const value = await this.haService.loadState(day);
						initialSlots[day] = this.parseScheduleString(value);
					})
				);

				this.state$.next({
					slots: initialSlots,
					loading: false,
					dialog: { currentSlot: null, isOpen: false },
				});

				logger.debug('Store initialized with:', initialSlots);
			} catch (error) {
				logger.error('Failed to initialize store:', error);
				this.initPromise = null;
				throw error;
			}
		})();

		return this.initPromise;
	}
}
