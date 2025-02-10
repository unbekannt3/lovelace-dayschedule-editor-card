const isDevelopment = process.env.NODE_ENV === 'development';
const PREFIX = '  DAYSCHEDULE EDITOR CARD  ';
const PREFIX_STYLE = 'color: orange; font-weight: bold; background: black';

export const logger = {
	debug: (...args: any[]) => {
		if (isDevelopment) {
			console.debug(`%c${PREFIX}`, PREFIX_STYLE, ...args);
		}
	},
	info: (...args: any[]) => {
		if (isDevelopment) {
			console.info(`%c${PREFIX}`, PREFIX_STYLE, ...args);
		}
	},
	warn: (...args: any[]) => {
		if (isDevelopment) {
			console.warn(`%c${PREFIX}`, PREFIX_STYLE, ...args);
		}
	},
	error: (...args: any[]) => {
		// alwyas log errors
		console.error(`%c${PREFIX}`, PREFIX_STYLE, ...args);
	},
};
