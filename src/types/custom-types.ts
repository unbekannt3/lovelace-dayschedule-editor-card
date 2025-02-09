import { LovelaceCardConfig } from 'custom-card-helpers';

export interface TimeSlot {
	start: string;
	end: string;
	value: string;
}

export interface Translations {
	add: string;
	edit: string;
	delete: string;
	cancel: string;
	save: string;
	start_time: string;
	end_time: string;
	value: string;
	monday: string;
	tuesday: string;
	wednesday: string;
	thursday: string;
	friday: string;
	saturday: string;
	sunday: string;
}

export interface DayEntityConfig {
	monday: string;
	tuesday: string;
	wednesday: string;
	thursday: string;
	friday: string;
	saturday: string;
	sunday: string;
}

export interface DayscheduleEditorCardConfig extends LovelaceCardConfig {
	entities: DayEntityConfig;
	name?: string;
}

export const DEFAULT_CONFIG: Partial<DayscheduleEditorCardConfig> = {
	name: 'Schedule Editor',
};
