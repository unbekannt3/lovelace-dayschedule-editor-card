import { HomeAssistant } from 'custom-card-helpers';
import * as de from '../locales/de.json';
import * as en from '../locales/en.json';

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

const languages: Record<string, unknown> = {
	de,
	en,
};

const DEFAULT_LANG = 'en';

function getTranslatedString(
	key: TranslationKey,
	lang: string
): string | undefined {
	try {
		return key
			.split('.')
			.reduce(
				(o, i) => (o as Record<string, unknown>)[i],
				languages[lang]
			) as string;
	} catch (_) {
		return undefined;
	}
}

/**
 * @usage
 * const localize = useLocalize(hass);
 *
 * localize("translation_key");
 * @param hass HomeAssistant instance
 */
export default function useLocalize(hass?: HomeAssistant) {
	return function (key: TranslationKey): string {
		const lang = hass?.locale.language ?? DEFAULT_LANG;

		let translated = getTranslatedString(key, lang);
		if (!translated) translated = getTranslatedString(key, DEFAULT_LANG);
		return translated ?? key;
	};
}
