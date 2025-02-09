import { ITimeSlot } from './slot.interface';

export interface ISchedule {
	[day: string]: ITimeSlot[];
}

export interface IScheduleManager {
	loadSchedule(day: string): Promise<ITimeSlot[]>;
	saveSchedule(day: string, slots: ITimeSlot[]): Promise<void>;
}
