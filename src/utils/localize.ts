import en from '../locales/en.json';
import de from '../locales/de.json';
import { logger } from './logger';
import { WeekDay } from 'const/days';

type AllowedDayKeys =
	| 'days.monday'
	| 'days.tuesday'
	| 'days.wednesday'
	| 'days.thursday'
	| 'days.friday'
	| 'days.saturday'
	| 'days.sunday';

type NestedKeyOf<ObjectType extends object> = {
	[Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
		? `${Key}.${NestedKeyOf<ObjectType[Key]>}`
		: `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<typeof en> | AllowedDayKeys;

const TRANSLATIONS: { [key: string]: any } = {
	en,
	de,
};

export function getDefaultLanguage(): string {
	return navigator.language.split('-')[0] || 'en';
}

export function localize(
	key: TranslationKey,
	lang: string = getDefaultLanguage()
): string {
	const translation = TRANSLATIONS[lang] || TRANSLATIONS.en;
	const paths = key.split('.');
	let current = translation;

	for (const path of paths) {
		if (current[path] === undefined) {
			logger.warn(`No translation found for ${key} in ${lang}`);
			current = TRANSLATIONS.en;
			for (const fallbackPath of paths) {
				if (current[fallbackPath] === undefined) {
					return key;
				}
				current = current[fallbackPath];
			}
			return current;
		}
		current = current[path];
	}

	return current;
}

export function abbreviateDay(day: WeekDay, language: string): string {
	const translationKey = `days.${day}` as AllowedDayKeys;
	const dayName = localize(translationKey, language);
	const abbrevLength = language === 'de' ? 2 : 3;
	return dayName.substring(0, abbrevLength);
}
