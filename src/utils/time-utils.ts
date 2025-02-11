import { ITimeSlot } from '../interfaces/slot.interface';
import { logger } from './logger';

export function parseTimeToMinutes(time: string): number {
	const [hours, minutes] = time.split(':').map(Number);
	return hours * 60 + minutes;
}

export function formatMinutesToTime(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${hours.toString().padStart(2, '0')}:${mins
		.toString()
		.padStart(2, '0')}`;
}

export function mergeOverlappingSlots(slots: ITimeSlot[]): ITimeSlot[] {
	if (!slots.length) return [];

	// convert time to minutes for easier comparison
	let timeRanges = slots.map((slot) => ({
		start: parseTimeToMinutes(slot.start),
		end: parseTimeToMinutes(slot.end),
	}));

	// sort by start time
	timeRanges.sort((a, b) => a.start - b.start);

	logger.debug('Sorting slots:', timeRanges);

	// merge overlapping and adjacent time ranges
	const merged = [timeRanges[0]];
	for (let i = 1; i < timeRanges.length; i++) {
		const current = timeRanges[i];
		const previous = merged[merged.length - 1];

		// check for overlap or direct adjacency (end = start)
		if (current.start <= previous.end || current.start === previous.end) {
			// merge the slots
			previous.end = Math.max(previous.end, current.end);
			logger.debug('Merged adjacent or overlapping slots:', {
				previous,
				current,
			});
		} else {
			// no overlap or adjacency - add as new slot
			merged.push(current);
		}
	}

	// convert back to time format
	const result = merged.map((range) => ({
		start: formatMinutesToTime(range.start),
		end: formatMinutesToTime(range.end),
	}));

	logger.debug('Final merged slots:', result);
	return result;
}
