import { LovelaceCardConfig } from 'custom-card-helpers';

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
