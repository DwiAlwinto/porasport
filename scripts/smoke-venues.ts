import { getVenues, getPublicFieldSlots } from '../src/actions/venueActions';
import { venuePriceBounds, venueHasRateWithin, venueHasRateInTimeOfDay, venuePriceEntries } from '../src/lib/pricing';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const rupiah = (n: number) => 'Rp' + n.toLocaleString('id-ID');
let fail = 0;
const check = (label: string, ok: boolean, extra = '') => {
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};

(async () => {
  console.log('=== getVenues() ===');
  const venues = await getVenues();
  console.log(`venue dikembalikan: ${venues.length}`);
  for (const v of venues) {
    console.log(
      `  - ${v.name} | slug=${v.slug} | sports=${v.sportTypes.join(',')} | fields=${v.fields.length} | createdAt=${v.createdAt}`
    );
  }
  check('minimal 1 venue di database', venues.length >= 1, `(${venues.length})`);

  const v0 = venues[0] as any;
  check('venue punya tarif', venuePriceEntries(v0).length > 0, `(${venuePriceEntries(v0).length} entri)`);
  check('tanpa batas anggaran venue tampil', venueHasRateWithin(v0, null) === true);
  check('filter waktu ALL lolos', venueHasRateInTimeOfDay(v0, 'ALL') === true);

  const bounds = venuePriceBounds(venues as any);
  console.log(`batas slider dari data: ${rupiah(bounds.min)} - ${rupiah(bounds.max)}`);
  check('batas min < max', bounds.min < bounds.max);

  console.log('\n=== getPublicFieldSlots() ===');
  const today = new Date();
  const key = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
  console.log(`tanggal uji: ${key}`);

  const noCat = await getPublicFieldSlots({ fieldId: v0.fields[0].id, date: key });
  check('berhasil ambil slot', noCat.ok, `error=${noCat.error ?? '-'}`);
  console.log(`  slot: ${noCat.slots.length}`);
  const sample = noCat.slots[0];
  if (sample) {
    console.log(`  contoh: ${sample.timeStart}-${sample.timeEnd} ${rupiah(sample.price)} status=${sample.status}`);
  }
  check('slotcovers 06:00-23:00', noCat.slots.length === 17, `(${noCat.slots.length})`);

  // Harga harus ikut kategori
  const withCat = await getPublicFieldSlots({
    fieldId: 'field-wibawa-stadion-penonton',
    date: key,
    userCategory: 'PROFESIONAL',
  });
  const jam19 = withCat.slots.find((s) => s.hour === 19);
  const jam10 = withCat.slots.find((s) => s.hour === 10);
  console.log(`  Profesional jam 19: ${rupiah(jam19?.price ?? 0)} (harapan 88.000.000)`);
  console.log(`  Profesional jam 10: ${rupiah(jam10?.price ?? 0)} (harapan 80.000.000)`);
  check('harga server jam 19 benar', jam19?.price === 88_000_000);
  check('harga server jam 10 benar', jam10?.price === 80_000_000);

  const sosial = await getPublicFieldSlots({
    fieldId: 'field-wibawa-stadion-penonton',
    date: key,
    userCategory: 'SOSIAL',
  });
  console.log(`  Sosial jam 10: ${rupiah(sosial.slots.find((s) => s.hour === 10)?.price ?? 0)} (harapan 50.000.000)`);
  check('harga Sosial benar', sosial.slots.find((s) => s.hour === 10)?.price === 50_000_000);

  console.log('\n=== konsistensi slot di database ===');
  const fields = await prisma.venueField.findMany({ select: { id: true, name: true } });
  let bad = 0;
  let total = 0;
  for (const f of fields) {
    const rows = await prisma.fieldSlot.findMany({ where: { fieldId: f.id } });
    total += rows.length;
    for (const r of rows) {
      const dateKey = r.date.toISOString().slice(0, 10);
      const idKey = r.id.split('-').slice(-4, -1).join('-');
      if (dateKey !== idKey) bad++;
    }
  }
  console.log(`total slot: ${total} | id tidak konsisten dengan kolom date: ${bad}`);
  check('tidak ada slot dengan id/date tidak cocok', bad === 0, `(${bad})`);

  const days = await prisma.fieldSlot.findMany({ select: { date: true }, distinct: ['date'] });
  check('45 hari territory tersedia', days.length === 45, `(${days.length})`);

  console.log(`\n=== smoke test selesai, ${fail} gagal ===`);
  await prisma.$disconnect();
  if (fail > 0) process.exitCode = 1;
})();
