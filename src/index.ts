/**
 * Lovelace card for editing daily schedules
 * based on input_text entities
 */

import { logger } from './utils/logger';

// Warte auf Custom Elements Registry
const waitForRegistry = async () => {
	if (customElements.get('home-assistant-main')) {
		return true;
	}

	return new Promise<boolean>((resolve) => {
		const observer = new MutationObserver(() => {
			if (customElements.get('home-assistant-main')) {
				observer.disconnect();
				resolve(true);
			}
		});

		observer.observe(document.head, {
			childList: true,
			subtree: true,
		});
	});
};

// Initialisiere Karte
const initCard = async () => {
	try {
		await waitForRegistry();
		await import('./card/dayschedule-editor-card');
		logger.info('Card registration complete');
	} catch (error) {
		logger.error('Failed to initialize card:', error);
	}
};

// Starte Initialisierung
void initCard();

// Optional: Zeige Version
import { printVersion } from './utils/print-version';
printVersion();
