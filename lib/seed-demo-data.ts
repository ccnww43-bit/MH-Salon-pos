import { db } from "@/lib/db";

// Demo activity for sales presentations: realistic-looking customers,
// bookings, and completed sales, built on top of whatever services and
// retail products already exist in the catalog (e.g. the starter
// catalog). Everything this creates is tagged isDemo: true, so it can be
// found and removed later with clearDemoData() — without touching the
// real service/product catalog, settings, or admin account.
export async function seedDemoData() {
  const now = new Date();

  const customerSeeds = [
    { name: "Amina Hassan", phone: "0712345678", email: "amina@example.com", gender: "Female" },
    { name: "Brian Otieno", phone: "0723456789", email: "brian@example.com", gender: "Male" },
    { name: "Grace Wanjiru", phone: "0734567890", email: "grace@example.com", gender: "Female" },
  ];

  const services = await db.services.filter(s => s.isActive).toArray();

  const customerIds: number[] = [];
  let bookingCount = 0;
  let saleCount = 0;

  await db.transaction('rw', db.customers, db.bookings, db.sales, async () => {
    for (const c of customerSeeds) {
      const id = await db.customers.add({
        ...c,
        dob: "",
        notes: "Demo customer for presentation.",
        creditBalance: 0,
        loyaltyPoints: 0,
        isDemo: true,
        createdAt: now,
        updatedAt: now,
      } as any);
      customerIds.push(id as number);
    }

    if (services.length > 0) {
      // A few upcoming appointments, so the Bookings calendar isn't empty.
      for (let i = 0; i < 4; i++) {
        const svc = services[i % services.length];
        const custIdx = i % customerIds.length;
        const day = new Date(now);
        day.setDate(day.getDate() + i);

        await db.bookings.add({
          customerId: customerIds[custIdx],
          customerName: customerSeeds[custIdx].name,
          type: 'Appointment',
          status: i === 0 ? 'Confirmed' : 'Booked',
          bookingDate: day,
          startTime: '10:00',
          endTime: '11:00',
          services: [{ serviceId: svc.id!, name: svc.name, price: svc.price }],
          isDemo: true,
          createdAt: now,
          updatedAt: now,
        } as any);
        bookingCount++;
      }

      // A short history of completed sales over the past few days, so the
      // Dashboard, Reports, and Transactions pages show real activity.
      for (let i = 0; i < 6; i++) {
        const svc = services[(i + 2) % services.length];
        const custIdx = i % customerIds.length;
        const saleDate = new Date(now);
        saleDate.setDate(saleDate.getDate() - i);

        const subtotal = svc.price;
        const receiptNumber = `DEMO-${Date.now().toString().slice(-8)}${i}`;

        await db.sales.add({
          receiptNumber,
          customerId: customerIds[custIdx],
          customerName: customerSeeds[custIdx].name,
          items: [{
            id: `demo-${i}`,
            type: 'Service',
            name: svc.name,
            price: svc.price,
            quantity: 1,
            discount: 0,
            total: svc.price,
            serviceId: svc.id,
          }],
          subtotal,
          discount: 0,
          tax: 0,
          total: subtotal,
          totalPaid: subtotal,
          balance: 0,
          status: 'Paid',
          transactionStatus: 'Completed',
          payments: [{ method: 'Cash', amount: subtotal, date: saleDate }],
          cashierId: '0',
          cashierName: 'Demo',
          isDemo: true,
          createdAt: saleDate,
          updatedAt: saleDate,
        } as any);
        saleCount++;
      }
    }
  });

  return { customers: customerIds.length, bookings: bookingCount, sales: saleCount };
}

// Deletes only the records seedDemoData() created (isDemo: true) — demo
// customers, bookings, and sales — leaving the real service/product
// catalog, settings, and admin account untouched.
export async function clearDemoData() {
  await db.transaction('rw', db.customers, db.bookings, db.sales, async () => {
    await db.customers.filter(c => c.isDemo === true).delete();
    await db.bookings.filter((b: any) => b.isDemo === true).delete();
    await db.sales.filter((s: any) => s.isDemo === true).delete();
  });
}
