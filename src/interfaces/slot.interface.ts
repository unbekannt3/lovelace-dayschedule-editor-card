export interface ITimeSlot {
	start: string;
	end: string;
}

export interface ITimeSlotChangeEvent {
	type: 'add' | 'edit' | 'delete' | 'cancel';
	slot: ITimeSlot;
	day: string;
	saved: boolean;
}

export interface ITimeSlotDialogConfig {
	open: boolean;
	slot: ITimeSlot;
	isNew: boolean;
	onClose: (event: ITimeSlotChangeEvent | null) => void;
}
