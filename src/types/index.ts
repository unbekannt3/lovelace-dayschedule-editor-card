export * from './custom-types';

export interface CustomCard {
	type: string;
	name: string;
	description: string;
}

declare global {
	interface Window {
		customCards: CustomCard[];
		DayscheduleEditorCard: any;
	}
}
