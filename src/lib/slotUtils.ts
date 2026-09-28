import { FieldSlot } from '../types';
import type { UserCategory } from '@prisma/client';
import { resolveFieldPrice, type ResolvableRate } from './pricing';

/**
 * Bangun grid slot satu lapangan untuk satu tanggal.
 *
 * Harga dihitung lewat `resolveFieldPrice` yang sama dengan server, sehingga
 * tampilan di browser dan total tagihan di server tidak bisa berbeda.
 */
export function generateDaySlotsForField(
  fieldId: string,
  date: string,
  priceNonPeak: number,
  pricePeak: number,
  customBookedHours: number[] = [],
  customMaintenanceHours: number[] = [],
  rates: ResolvableRate[] = [],
  userCategory: UserCategory | null = null
): FieldSlot[] {
  const slots: FieldSlot[] = [];

  for (let hour = 6; hour < 23; hour++) {
    const isPeak = hour >= 16;
    const timeStart = `${hour.toString().padStart(2, '0')}:00`;
    const timeEnd = `${(hour + 1).toString().padStart(2, '0')}:00`;
    const { price } = resolveFieldPrice({
      rates,
      priceNonPeak,
      pricePeak,
      category: userCategory,
      hour,
      isPeak,
    });

    let status: 'AVAILABLE' | 'BOOKED' | 'MAINTENANCE' = 'AVAILABLE';
    if (customMaintenanceHours.includes(hour)) {
      status = 'MAINTENANCE';
    } else if (customBookedHours.includes(hour)) {
      status = 'BOOKED';
    }

    slots.push({
      id: `${fieldId}-${date}-${hour}`,
      fieldId,
      date,
      timeStart,
      timeEnd,
      hour,
      price,
      isPeakHour: isPeak,
      status,
    });
  }

  return slots;
}
