interface RegisterCardParams {
	type: string;
	name: string;
	description: string;
}

export function registerCustomCard(params: RegisterCardParams): void {
	try {
		const windowWithCards = window as unknown as Window & {
			customCards: Array<
				RegisterCardParams & { preview: boolean; documentationURL?: string }
			>;
		};

		// Ensure customCards array exists
		windowWithCards.customCards = windowWithCards.customCards || [];

		// Check if card is already registered
		if (
			!windowWithCards.customCards.some((card) => card.type === params.type)
		) {
			windowWithCards.customCards.push({
				...params,
				preview: true,
			});
		}
	} catch (error) {
		console.error('Failed to register custom card:', error);
	}
}
