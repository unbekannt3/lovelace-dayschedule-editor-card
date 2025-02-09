export * from './custom-types';

declare global {
	interface Window {
		customCards: Array<Object>;
		DayscheduleEditorCard: any;
	}
}
