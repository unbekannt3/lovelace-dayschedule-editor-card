const VERSION =
	process.env.NODE_ENV === 'development' ? 'DEVELOPMENT' : '__VERSION__';

export const printVersion = () =>
	console.info(
		`%c  DAYSCHEDULE EDITOR CARD  \n%c  Version ${VERSION.replace(/"/g, '')} `,
		'color: orange; font-weight: bold; background: black',
		'color: white; font-weight: bold; background: dimgray'
	);
