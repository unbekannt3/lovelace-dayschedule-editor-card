import { logger } from '../utils/logger';

export const MAIN_CARD_NAME = 'dayschedule-editor-card';
export const EDITOR_NAME = 'dayschedule-editor-card-editor';
export const GRID_NAME = 'dayschedule-editor-card-grid';
export const DIALOG_NAME = 'dayschedule-editor-card-dialog';

export function checkRegisteredElements(): boolean {
	const components = [MAIN_CARD_NAME, EDITOR_NAME, GRID_NAME, DIALOG_NAME];

	const missing = components.filter((name) => !customElements.get(name));

	if (missing.length > 0) {
		logger.warn('Missing components:', missing);
		return false;
	}

	logger.info('All components registered successfully');
	return true;
}
