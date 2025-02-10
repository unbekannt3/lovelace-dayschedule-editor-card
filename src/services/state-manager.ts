import { WeekDay } from '../const/days';
import { ITimeSlot } from '../interfaces/slot.interface';
import { logger } from '../utils/logger';

export type StateUpdateCallback = (day: WeekDay, slots: ITimeSlot[]) => void;

export class StateManager {
	private static instance: StateManager;
	private subscribers: Map<string, Set<StateUpdateCallback>> = new Map();
	private state: { [key in WeekDay]?: ITimeSlot[] } = {};

	private constructor() {}

	public static getInstance(): StateManager {
		if (!StateManager.instance) {
			StateManager.instance = new StateManager();
		}
		return StateManager.instance;
	}

	public subscribe(
		componentId: string,
		callback: StateUpdateCallback
	): () => void {
		if (!this.subscribers.has(componentId)) {
			this.subscribers.set(componentId, new Set());
		}
		this.subscribers.get(componentId)!.add(callback);

		// Return unsubscribe function
		return () => {
			const subs = this.subscribers.get(componentId);
			if (subs) {
				subs.delete(callback);
				if (subs.size === 0) {
					this.subscribers.delete(componentId);
				}
			}
		};
	}

	public updateState(day: WeekDay, slots: ITimeSlot[]): void {
		logger.debug(`StateManager: Updating state for ${day}`, slots);
		this.state[day] = [...slots];
		this.notifySubscribers(day, slots);
	}

	public getState(day: WeekDay): ITimeSlot[] {
		return this.state[day] || [];
	}

	private notifySubscribers(day: WeekDay, slots: ITimeSlot[]): void {
		this.subscribers.forEach((callbacks, componentId) => {
			logger.debug(`StateManager: Notifying ${componentId} for ${day}`);
			callbacks.forEach((callback) => {
				try {
					callback(day, slots);
				} catch (error) {
					logger.error(`Error notifying subscriber ${componentId}:`, error);
				}
			});
		});
	}

	public clear(): void {
		this.state = {};
		this.subscribers.clear();
	}
}
