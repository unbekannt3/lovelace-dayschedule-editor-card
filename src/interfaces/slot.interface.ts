import { ETimeSlotType } from 'enums/slot.enum';

export interface ITimeSlot {
	start: string;
	end: string;
}

export interface ITimeSlotEdit {
	oldSlot: ITimeSlot | null;
	newSlot: ITimeSlot;
}

export interface ITimeSlotChangeEvent {
	type: ETimeSlotType;
	slot: ITimeSlot | ITimeSlotEdit;
	day: string;
	saved: boolean;
}

export interface ITimeSlotDialogConfig {
	open: boolean;
	slot: ITimeSlot;
	isNew: boolean;
	onClose: (event: ITimeSlotChangeEvent | null) => void;
}
