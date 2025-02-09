import { logger } from './logger';

const VERSION =
	process.env.NODE_ENV === 'development' ? 'DEVELOPMENT' : '__VERSION__';

export const printVersion = () => logger.info(`Version ${VERSION}`);
