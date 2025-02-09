import { MAIN_CARD_NAME } from './const/element-names';
import { logger } from './utils/logger';
import { printVersion } from 'utils';

// Import components in correct order
import './timeslot-dialog/time-slot-dialog';
import './schedule-grid/schedule-grid';
import './editor/dayschedule-editor-card-editor';
import './card/dayschedule-editor-card';

// Maximum number of retries and delay between retries
const MAX_RETRIES = 5;
const RETRY_DELAY = 1000;

const checkComponent = async (name: string, retries = 0): Promise<boolean> => {
	try {
		await customElements.whenDefined(name);
		logger.debug(`Component ${name} registered successfully`);
		return true;
	} catch (error) {
		if (retries < MAX_RETRIES) {
			logger.warn(`Retrying registration of ${name}, attempt ${retries + 1}`);
			await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
			return checkComponent(name, retries + 1);
		}
		logger.error(`Failed to register ${name} after ${MAX_RETRIES} attempts`);
		return false;
	}
};

const registerWithHA = () => {
	logger.info('Registering card with Home Assistant');
	window.customCards = window.customCards || [];
	window.customCards.push({
		type: MAIN_CARD_NAME,
		name: 'Dayschedule Editor Card',
		description:
			'A custom card for editing daily schedules using input_text entities.',
	});
	printVersion();
};

const initializeComponents = async () => {
	const components = [
		'dayschedule-editor-card-dialog',
		'dayschedule-editor-card-grid',
		'dayschedule-editor-card-editor',
		'dayschedule-editor-card',
	];

	try {
		const results = await Promise.all(
			components.map((component) => checkComponent(component))
		);

		if (results.every(Boolean)) {
			logger.info('All components registered successfully');
			registerWithHA();
		} else {
			logger.error(
				'Some components failed to register:',
				components.filter((_, i) => !results[i])
			);
		}
	} catch (error) {
		logger.error('Failed to initialize components:', error);
	}
};

// Start initialization when document is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeComponents);
} else {
	initializeComponents();
}

// Export for type declarations
export * from './card/dayschedule-editor-card';
