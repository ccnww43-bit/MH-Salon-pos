import { db } from "@/lib/db";
import { hashPassword } from "@/lib/security";

// Full demo dataset for presentations AND for testing every screen in the
// app end-to-end. This seeds every table the schema defines — customers,
// staff, users, bookings, sales, inventory + stock movements, suppliers,
// purchase orders, commissions, packages, memberships, vouchers,
// promotions, expenses, leave, attendance, loyalty history, cash drawer
// activity, held sales, clinical records, and a few audit log lines — all
// on top of whatever service catalog already exists (seeding the real
// catalog first if the database is completely empty, e.g. a fresh
// Training Mode install).
//
// Everything this creates is tagged isDemo: true (top-level on tables that
// declare it, or via an `as any` cast on tables that don't) so it can be
// found and removed later with clearDemoData() without touching the real
// service catalog, settings, or the real admin account.

const DEMO_PASSWORD = "Demo@1234";

export async function seedDemoData() {
  const now = new Date();

  // 1. Make sure there's a service catalog to build bookings/sales/
  // packages/promotions against. On a fresh Training Mode database this
  // will be empty, so load the real 185-item catalog first (skips
  // automatically if services already exist).
  if ((await db.services.count()) === 0) {
    const { seedRealCatalog } = await import("@/lib/starter-catalog");
    await seedRealCatalog();
  }

  const services = await db.services.filter(s => s.isActive).toArray();
  const byCategory = (cat: string) => services.filter((s: any) => s.category === cat);
  const pick = (arr: any[], i: number) => arr.length ? arr[i % arr.length] : null;

  const beauty = byCategory("Beauty");
  const clinic = byCategory("Clinic");
  const facials = byCategory("Facials");
  const spa = byCategory("SPA");

  // Pre-compute password hashes OUTSIDE the transaction — hashPassword uses
  // WebCrypto/PBKDF2 (100,000 iterations), and keeping slow non-Dexie work
  // out of the transaction body avoids any risk of it stalling/timing out.
  const supervisorAuth = await hashPassword(DEMO_PASSWORD);
  const cashierAuth = await hashPassword(DEMO_PASSWORD);

  const counts = {
    customers: 0, staff: 0, users: 0, clinicalRecords: 0, suppliers: 0,
    inventory: 0, commissions: 0, packages: 0, memberships: 0, vouchers: 0,
    promotions: 0, expenses: 0, purchaseOrders: 0, leave: 0, attendance: 0,
    loyaltyEntries: 0, bookings: 0, sales: 0, cashMovements: 0, heldSales: 0,
    auditLogs: 0,
  };

  await db.transaction(
    "rw",
    [
      db.customers, db.clinicalRecords, db.bookings, db.sales, db.moduleRecords,
      db.inventory, db.inventoryMovements, db.cashDrawers, db.cashMovements,
      db.heldSales, db.users, db.auditLogs, db.settings,
    ],
    async () => {
      // --- Customers ------------------------------------------------
      const customerSeeds = [
        { name: "Amina Hassan", phone: "0712345678", email: "amina@example.com", gender: "Female" },
        { name: "Brian Otieno", phone: "0723456789", email: "brian@example.com", gender: "Male" },
        { name: "Grace Wanjiru", phone: "0734567890", email: "grace@example.com", gender: "Female" },
        { name: "Fatuma Ali", phone: "0745678901", email: "fatuma@example.com", gender: "Female" },
        { name: "Kevin Mwangi", phone: "0756789012", email: "kevin@example.com", gender: "Male" },
        { name: "Njeri Kamau", phone: "0767890123", email: "njeri@example.com", gender: "Female" },
        { name: "Samuel Kiptoo", phone: "0778901234", email: "samuel@example.com", gender: "Male" },
        { name: "Zainab Mohamed", phone: "0789012345", email: "zainab@example.com", gender: "Female" },
        { name: "Peter Omondi", phone: "0790123456", email: "peter@example.com", gender: "Male" },
        { name: "Winnie Achieng", phone: "0701234567", email: "winnie@example.com", gender: "Female" },
      ];

      const customerIds: number[] = [];
      for (const c of customerSeeds) {
        const id = await db.customers.add({
          ...c,
          dob: "",
          notes: "Demo customer for testing.",
          creditBalance: 0,
          loyaltyPoints: 0,
          isDemo: true,
          createdAt: now,
          updatedAt: now,
        } as any);
        customerIds.push(id as number);
      }
      counts.customers = customerIds.length;

      // --- Staff (moduleRecords: 'staff') ----------------------------
      const staffSeeds = [
        { name: "Mercy Wambui", phone: "0711000001", position: "Senior Stylist", status: "Active" },
        { name: "Joseph Mutua", phone: "0711000002", position: "Junior Stylist", status: "Active" },
        { name: "Lucy Njoroge", phone: "0711000003", position: "Beautician", status: "Active" },
        { name: "Ann Chebet", phone: "0711000004", position: "Receptionist", status: "Active" },
        { name: "David Kariuki", phone: "0711000005", position: "Specialist", status: "Active" },
        { name: "Cynthia Adhiambo", phone: "0711000006", position: "Senior Stylist", status: "On Leave" },
        { name: "Moses Langat", phone: "0711000007", position: "Junior Stylist", status: "Inactive" },
      ];

      const staffIds: number[] = [];
      for (const s of staffSeeds) {
        const id = await db.moduleRecords.add({
          module: "staff",
          title: s.name,
          status: s.status,
          data: { ...s, userId: "" },
          isDemo: true,
          createdAt: now,
          updatedAt: now,
        } as any);
        staffIds.push(id as number);
      }
      counts.staff = staffIds.length;

      // --- Demo login accounts (Supervisor + Cashier), linked to two
      // of the staff members above so Staff <-> Users linkage can be
      // tested too. The real Admin account created during setup is
      // never touched.
      const supervisorUserId = await db.users.add({
        username: "demo.supervisor",
        passwordHash: supervisorAuth.passwordHash,
        passwordSalt: supervisorAuth.passwordSalt,
        role: "Supervisor",
        isActive: true,
        isDemo: true,
        createdAt: now,
        updatedAt: now,
      } as any);

      const cashierUserId = await db.users.add({
        username: "demo.cashier",
        passwordHash: cashierAuth.passwordHash,
        passwordSalt: cashierAuth.passwordSalt,
        role: "Cashier",
        isActive: true,
        isDemo: true,
        createdAt: now,
        updatedAt: now,
      } as any);
      counts.users = 2;

      await db.moduleRecords.update(staffIds[0], { data: { ...staffSeeds[0], userId: String(supervisorUserId) } });
      await db.moduleRecords.update(staffIds[1], { data: { ...staffSeeds[1], userId: String(cashierUserId) } });

      // --- Clinical records / Customer records -----------------------
      if (services.length > 0) {
        const recordTypes: any[] = ["Consultation", "Treatment", "Progress Note"];
        for (let i = 0; i < 6; i++) {
          const day = new Date(now);
          day.setDate(day.getDate() - i * 3);
          await db.clinicalRecords.add({
            customerId: customerIds[i % customerIds.length],
            date: day,
            recordType: recordTypes[i % recordTypes.length],
            staffId: staffIds[i % staffIds.length],
            serviceId: pick(clinic.length ? clinic : services, i)?.id,
            notes: "Client responded well; recommended follow-up in 3 weeks.",
            isDemo: true,
            createdAt: day,
            updatedAt: day,
          } as any);
          counts.clinicalRecords++;
        }
      }

      // --- Suppliers (moduleRecords: 'supplier') ----------------------
      const supplierSeeds = [
        { name: "Beauty Supplies Kenya Ltd", contactPerson: "James Ndung'u", phone: "0722111222", email: "sales@beautysupplies.co.ke", address: "Industrial Area, Nairobi" },
        { name: "GlowPro Distributors", contactPerson: "Sarah Wanjala", phone: "0733222333", email: "orders@glowpro.co.ke", address: "Westlands, Nairobi" },
        { name: "Nairobi Salon Essentials", contactPerson: "Tom Kiplagat", phone: "0744333444", email: "info@salonessentials.co.ke", address: "CBD, Nairobi" },
        { name: "Prime Cosmetics Wholesale", contactPerson: "Betty Wairimu", phone: "0755444555", email: "wholesale@primecosmetics.co.ke", address: "Ngara, Nairobi" },
      ];
      const supplierIds: number[] = [];
      for (const s of supplierSeeds) {
        const id = await db.moduleRecords.add({
          module: "supplier",
          title: s.name,
          status: "Active",
          data: s,
          isDemo: true,
          createdAt: now,
          updatedAt: now,
        } as any);
        supplierIds.push(id as number);
      }
      counts.suppliers = supplierIds.length;

      // --- Inventory (retail + operational stock) ---------------------
      const inventorySeeds: any[] = [
        { type: "Retail", name: "Argan Oil Shampoo 500ml", category: "Hair Care", sku: "RET-001", costPrice: 600, sellingPrice: 1200, currentStock: 24, minimumStock: 10 },
        { type: "Retail", name: "Keratin Conditioner 500ml", category: "Hair Care", sku: "RET-002", costPrice: 650, sellingPrice: 1300, currentStock: 18, minimumStock: 10 },
        { type: "Retail", name: "Vitamin C Serum 30ml", category: "Skin Care", sku: "RET-003", costPrice: 900, sellingPrice: 2000, currentStock: 4, minimumStock: 6 },
        { type: "Retail", name: "SPF 50 Sunscreen", category: "Skin Care", sku: "RET-004", costPrice: 500, sellingPrice: 1100, currentStock: 15, minimumStock: 8 },
        { type: "Retail", name: "Nail Polish Set", category: "Nail Care", sku: "RET-005", costPrice: 300, sellingPrice: 700, currentStock: 30, minimumStock: 10 },
        { type: "Operational", name: "Hair Color Tubes (Assorted)", category: "Consumables", sku: "OPS-001", costPrice: 350, sellingPrice: 0, currentStock: 40, minimumStock: 15 },
        { type: "Operational", name: "Disposable Gloves (Box)", category: "Consumables", sku: "OPS-002", costPrice: 450, sellingPrice: 0, currentStock: 3, minimumStock: 5 },
        { type: "Operational", name: "Wax Strips (Pack)", category: "Consumables", sku: "OPS-003", costPrice: 250, sellingPrice: 0, currentStock: 20, minimumStock: 8 },
        { type: "Operational", name: "Facial Masks (Box of 50)", category: "Consumables", sku: "OPS-004", costPrice: 1500, sellingPrice: 0, currentStock: 2, minimumStock: 4 },
        { type: "Retail", name: "Lip Gloss Collection", category: "Cosmetics", sku: "RET-006", costPrice: 200, sellingPrice: 500, currentStock: 22, minimumStock: 10 },
      ];

      const inventoryIds: number[] = [];
      for (let i = 0; i < inventorySeeds.length; i++) {
        const item = inventorySeeds[i];
        const id = await db.inventory.add({
          ...item,
          supplierId: supplierIds[i % supplierIds.length],
          isActive: true,
          isDemo: true,
          createdAt: now,
          updatedAt: now,
        } as any);
        inventoryIds.push(id as number);

        // Opening stock-in movement for every item so Inventory Movements
        // isn't empty and the before/after trail makes sense.
        await db.inventoryMovements.add({
          productId: id as number,
          type: "Stock In",
          quantity: item.currentStock,
          beforeQty: 0,
          afterQty: item.currentStock,
          userId: "System",
          reason: "Initial stock load (demo data)",
          date: now,
          isDemo: true,
        } as any);
      }
      counts.inventory = inventoryIds.length;

      // --- Commissions (moduleRecords: 'commission') -------------------
      // staffId kept as a string (like the form the Commissions page
      // actually submits) so it round-trips the same way real data would;
      // an empty string means "All Staff".
      const commissionSeeds = [
        { name: "Stylist Standard Commission", staffId: String(staffIds[0]), type: "Percentage", rate: "15", target: "", status: "Active" },
        { name: "Junior Staff Commission", staffId: String(staffIds[1]), type: "Percentage", rate: "10", target: "", status: "Active" },
        { name: "Monthly Sales Bonus", staffId: String(staffIds[2]), type: "Fixed Amount", rate: "3000", target: "50000", status: "Active" },
        { name: "Retail Upsell Incentive", staffId: "", type: "Percentage", rate: "5", target: "", status: "Paused" },
      ];
      for (const c of commissionSeeds) {
        const idx = staffIds.findIndex(id => String(id) === c.staffId);
        const staffMember = idx >= 0 ? staffSeeds[idx] : null;
        await db.moduleRecords.add({
          module: "commission",
          title: c.name,
          status: c.status,
          staffId: idx >= 0 ? staffIds[idx] : undefined,
          data: { ...c, staffName: staffMember?.name || "All Staff" },
          isDemo: true,
          createdAt: now,
          updatedAt: now,
        } as any);
        counts.commissions++;
      }

      // --- Packages (moduleRecords: 'package') --------------------------
      const packageSeeds = [
        { name: "Bridal Glow Bundle", price: "12000", sessions: "3", pool: [...beauty, ...facials] },
        { name: "Monthly Hair Care Plan", price: "8000", sessions: "4", pool: beauty },
        { name: "Relax & Refresh SPA Pack", price: "6000", sessions: "2", pool: spa },
        { name: "Skin Renewal Program", price: "15000", sessions: "5", pool: [...facials, ...clinic] },
      ];
      for (const p of packageSeeds) {
        const selectedServices = p.pool.slice(0, 3).map((s: any) => s.id);
        await db.moduleRecords.add({
          module: "package",
          title: p.name,
          status: "Active",
          amount: Number(p.price),
          quantity: Number(p.sessions),
          data: { name: p.name, price: p.price, sessions: p.sessions, selectedServices },
          isDemo: true,
          createdAt: now,
          updatedAt: now,
        } as any);
        counts.packages++;
      }

      // --- Memberships (moduleRecords: 'membership') --------------------
      const membershipSeeds = [
        { customerIdx: 0, plan: "Gold VIP", discount: "10" },
        { customerIdx: 1, plan: "Platinum Elite", discount: "15" },
        { customerIdx: 2, plan: "Standard Member", discount: "5" },
        { customerIdx: 3, plan: "Gold VIP", discount: "10" },
        { customerIdx: 4, plan: "Platinum Elite", discount: "15" },
      ];
      for (const m of membershipSeeds) {
        const expiry = new Date(now);
        expiry.setMonth(expiry.getMonth() + 6);
        await db.moduleRecords.add({
          module: "membership",
          title: `${m.plan}: ${customerSeeds[m.customerIdx].name}`,
          status: "Active",
          customerId: customerIds[m.customerIdx],
          data: {
            customerId: String(customerIds[m.customerIdx]),
            plan: m.plan,
            discount: m.discount,
            expiry: expiry.toISOString().split("T")[0],
            customerName: customerSeeds[m.customerIdx].name,
          },
          isDemo: true,
          createdAt: now,
          updatedAt: now,
        } as any);
        counts.memberships++;
      }

      // --- Vouchers (moduleRecords: 'voucher') --------------------------
      const futureExpiry = new Date(now); futureExpiry.setMonth(futureExpiry.getMonth() + 2);
      const pastExpiry = new Date(now); pastExpiry.setMonth(pastExpiry.getMonth() - 1);
      const voucherSeeds = [
        { code: "WELCOME500", amount: 500, expiry: futureExpiry.toISOString().split("T")[0] },
        { code: "VIP1000", amount: 1000, expiry: futureExpiry.toISOString().split("T")[0] },
        { code: "BDAY2000", amount: 2000, expiry: futureExpiry.toISOString().split("T")[0] },
        { code: "PROMO250", amount: 250, expiry: pastExpiry.toISOString().split("T")[0] }, // expired on purpose — exercises the Notifications "Voucher Expired" alert
        { code: "REFERRAL750", amount: 750, expiry: futureExpiry.toISOString().split("T")[0] },
      ];
      for (const v of voucherSeeds) {
        await db.moduleRecords.add({
          module: "voucher",
          title: v.code,
          status: "Active",
          amount: v.amount,
          data: { code: v.code, amount: String(v.amount), expiry: v.expiry, balance: v.amount },
          isDemo: true,
          createdAt: now,
          updatedAt: now,
        } as any);
        counts.vouchers++;
      }

      // --- Promotions (moduleRecords: 'promotion') -----------------------
      const promoStart = new Date(now); promoStart.setDate(promoStart.getDate() - 5);
      const promoEnd = new Date(now); promoEnd.setDate(promoEnd.getDate() + 25);
      const expiredPromoEnd = new Date(now); expiredPromoEnd.setDate(expiredPromoEnd.getDate() - 2);
      const promotionSeeds = [
        { name: "New Year Glow Up", discount: "20", pool: beauty, status: "Active" },
        { name: "Facial Friday Special", discount: "15", pool: facials, status: "Active" },
        { name: "SPA Weekday Discount", discount: "10", pool: spa, status: "Active" },
        { name: "Clearance Winter Promo", discount: "25", pool: clinic, status: "Paused" },
      ];
      for (const p of promotionSeeds) {
        const selectedServices = p.pool.slice(0, 2).map((s: any) => s.id);
        await db.moduleRecords.add({
          module: "promotion",
          title: p.name,
          status: p.status,
          amount: Number(p.discount),
          data: {
            name: p.name,
            discount: p.discount,
            start: promoStart.toISOString().split("T")[0],
            end: (p.status === "Paused" ? expiredPromoEnd : promoEnd).toISOString().split("T")[0],
            selectedServices,
            status: p.status,
          },
          isDemo: true,
          createdAt: now,
          updatedAt: now,
        } as any);
        counts.promotions++;
      }

      // --- Expenses (moduleRecords: 'expense') ---------------------------
      const expenseSeeds = [
        { category: "Rent", description: "Monthly shop rent", amount: 45000, method: "Bank Transfer", daysAgo: 20 },
        { category: "Utilities", description: "Electricity bill", amount: 6500, method: "M-Pesa", daysAgo: 15 },
        { category: "Salaries", description: "Staff salaries - partial", amount: 80000, method: "Bank Transfer", daysAgo: 10 },
        { category: "Supplies", description: "Restocked retail products", amount: 22000, method: "Cash", daysAgo: 8 },
        { category: "Transport", description: "Fuel & delivery costs", amount: 3200, method: "Cash", daysAgo: 6 },
        { category: "Maintenance", description: "AC servicing", amount: 4500, method: "M-Pesa", daysAgo: 4 },
        { category: "Petty Cash", description: "Office supplies", amount: 1500, method: "Cash", daysAgo: 2 },
        { category: "Other", description: "Marketing flyers", amount: 5000, method: "Card", daysAgo: 1 },
      ];
      for (const e of expenseSeeds) {
        const date = new Date(now); date.setDate(date.getDate() - e.daysAgo);
        await db.moduleRecords.add({
          module: "expense",
          title: `${e.category}: ${e.description}`,
          status: "Approved",
          amount: e.amount,
          data: {
            category: e.category, description: e.description, amount: String(e.amount),
            method: e.method, date: date.toISOString().split("T")[0], approvedBy: "Demo Admin",
          },
          isDemo: true,
          createdAt: date,
          updatedAt: date,
        } as any);
        counts.expenses++;
      }

      // --- Purchase Orders (moduleRecords: 'purchase-order') --------------
      const poSeeds = [
        { supplierIdx: 0, inventoryIdx: 0, quantity: 20, cost: 12000, status: "Received" },
        { supplierIdx: 1, inventoryIdx: 2, quantity: 15, cost: 13500, status: "Received" },
        { supplierIdx: 2, inventoryIdx: 6, quantity: 10, cost: 4500, status: "Awaiting" },
        { supplierIdx: 3, inventoryIdx: 8, quantity: 8, cost: 12000, status: "Awaiting" },
        { supplierIdx: 0, inventoryIdx: 3, quantity: 25, cost: 12500, status: "Received" },
      ];
      for (const po of poSeeds) {
        const product = inventorySeeds[po.inventoryIdx];
        const supplier = supplierSeeds[po.supplierIdx];
        const id = await db.moduleRecords.add({
          module: "purchase-order",
          title: `${product.name} via ${supplier.name}`,
          status: po.status,
          data: {
            supplierId: String(supplierIds[po.supplierIdx]),
            productId: String(inventoryIds[po.inventoryIdx]),
            quantity: String(po.quantity),
            cost: String(po.cost),
            productName: product.name,
            supplierName: supplier.name,
          },
          isDemo: true,
          createdAt: now,
          updatedAt: now,
        } as any);

        if (po.status === "Received") {
          const invId = inventoryIds[po.inventoryIdx];
          const row = await db.inventory.get(invId);
          if (row) {
            const before = row.currentStock;
            const after = before + po.quantity;
            await db.inventory.update(invId, { currentStock: after, updatedAt: now });
            await db.inventoryMovements.add({
              productId: invId, type: "Stock In", quantity: po.quantity, beforeQty: before,
              afterQty: after, userId: "Demo Admin", reason: "Procurement cycle finalized (demo)",
              date: now, isDemo: true,
            } as any);
          }
        }
        counts.purchaseOrders++;
      }

      // --- Leave (moduleRecords: 'leave') ----------------------------------
      // offsetDays: positive = starts in the future, negative = already started.
      const leaveSeeds = [
        { staffIdx: 5, type: "Annual Leave", status: "Approved", offsetDays: 3, len: 5 },
        { staffIdx: 2, type: "Sick Leave", status: "Approved", offsetDays: 1, len: 2 },
        { staffIdx: 3, type: "Emergency Leave", status: "Awaiting", offsetDays: -2, len: 1 },
        { staffIdx: 4, type: "Annual Leave", status: "Rejected", offsetDays: -10, len: 4 },
      ];
      for (const l of leaveSeeds) {
        const start = new Date(now); start.setDate(start.getDate() + l.offsetDays);
        const end = new Date(start); end.setDate(end.getDate() + l.len);
        await db.moduleRecords.add({
          module: "leave",
          title: `${staffSeeds[l.staffIdx].name}: ${l.type}`,
          status: l.status,
          staffId: staffIds[l.staffIdx],
          data: {
            staffId: String(staffIds[l.staffIdx]), type: l.type,
            start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0],
            notes: "Requested via demo data.", staffName: staffSeeds[l.staffIdx].name,
          },
          isDemo: true,
          createdAt: now,
          updatedAt: now,
        } as any);
        counts.leave++;
      }

      // --- Attendance (moduleRecords: 'attendance') — today's duty scans ---
      const activeStaffIdx = [0, 1, 2, 3, 4]; // the 5 "Active" staff
      for (let i = 0; i < activeStaffIdx.length; i++) {
        const idx = activeStaffIdx[i];
        const clockIn = new Date(now); clockIn.setHours(8, 0 + i * 5, 0, 0);
        await db.moduleRecords.add({
          module: "attendance",
          title: `${staffSeeds[idx].name} - Duty Start`,
          status: "On Site",
          staffId: staffIds[idx],
          data: { name: staffSeeds[idx].name, type: "IN", time: clockIn.toLocaleTimeString(), date: clockIn.toISOString().split("T")[0] },
          isDemo: true,
          createdAt: clockIn,
          updatedAt: clockIn,
        } as any);
        counts.attendance++;

        // First two have already clocked out, so both states are visible.
        if (i < 2) {
          const clockOut = new Date(clockIn); clockOut.setHours(clockOut.getHours() + 6);
          await db.moduleRecords.add({
            module: "attendance",
            title: `${staffSeeds[idx].name} - Duty End`,
            status: "Off Site",
            staffId: staffIds[idx],
            data: { name: staffSeeds[idx].name, type: "OUT", time: clockOut.toLocaleTimeString(), date: clockOut.toISOString().split("T")[0] },
            isDemo: true,
            createdAt: clockOut,
            updatedAt: clockOut,
          } as any);
          counts.attendance++;
        }
      }

      // --- Loyalty settings + history (moduleRecords: 'loyalty') -----------
      // The settings record itself is real configuration, not demo data —
      // only created if missing, and NOT tagged isDemo so clearDemoData()
      // never removes it.
      const existingLoyaltySettings = await db.moduleRecords
        .where("module").equals("loyalty")
        .filter((r: any) => r.title === "__loyalty_settings__")
        .first();
      if (!existingLoyaltySettings) {
        await db.moduleRecords.add({
          module: "loyalty",
          title: "__loyalty_settings__",
          status: "Settings",
          data: { pointsPerCurrency: 1, redemptionValue: 1 },
          createdAt: now,
          updatedAt: now,
        } as any);
      }

      for (let i = 0; i < 4; i++) {
        const type = i % 2 === 0 ? "Award" : "Redeem";
        const pts = type === "Award" ? 200 + i * 50 : 100;
        const custId = customerIds[i];
        const custRow = await db.customers.get(custId);
        const previousBalance = custRow?.loyaltyPoints || 0;
        const newBalance = type === "Award" ? previousBalance + pts : Math.max(0, previousBalance - pts);
        await db.customers.update(custId, { loyaltyPoints: newBalance, updatedAt: now });
        await db.moduleRecords.add({
          module: "loyalty",
          title: type === "Award" ? "Points Awarded" : "Points Redeemed",
          status: type,
          customerId: custId,
          amount: type === "Award" ? pts : -pts,
          data: { reason: type === "Award" ? "Manual bonus (demo)" : "Redeemed against sale (demo)", previousBalance, newBalance },
          isDemo: true,
          createdAt: now,
          updatedAt: now,
        } as any);
        counts.loyaltyEntries++;
      }

      // --- Bookings ------------------------------------------------------
      if (services.length > 0) {
        const bookingStatuses: any[] = ["Booked", "Confirmed", "Waiting", "In Progress", "Completed", "Completed", "Cancelled", "No Show"];
        for (let i = 0; i < bookingStatuses.length; i++) {
          const svc = pick(services, i + 1);
          const custIdx = i % customerIds.length;
          const day = new Date(now);
          // First entry is TODAY with status "Booked" so it also exercises
          // the Notifications "Upcoming Appointment" alert; the rest spread
          // across past/future days.
          day.setDate(day.getDate() + (i === 0 ? 0 : i - 3));
          const hour = 9 + (i % 6);

          await db.bookings.add({
            customerId: customerIds[custIdx],
            customerName: customerSeeds[custIdx].name,
            type: i % 3 === 0 ? "Walk-in" : "Appointment",
            status: bookingStatuses[i],
            bookingDate: day,
            startTime: `${String(hour).padStart(2, "0")}:00`,
            endTime: `${String(hour + 1).padStart(2, "0")}:00`,
            services: [{ serviceId: svc.id!, name: svc.name, price: svc.price, staffId: staffIds[i % staffIds.length] }],
            staffId: staffIds[i % staffIds.length],
            staffName: staffSeeds[i % staffIds.length].name,
            isDemo: true,
            createdAt: now,
            updatedAt: now,
            ...(bookingStatuses[i] === "Completed" ? { completedAt: day } : {}),
            ...(bookingStatuses[i] === "Cancelled" ? { cancelledAt: day, cancelledBy: "Demo Admin" } : {}),
          } as any);
          counts.bookings++;
        }
      }

      // --- Sales -----------------------------------------------------------
      if (services.length > 0) {
        const paymentMethods: any[] = ["Cash", "M-Pesa", "Card", "Bank Transfer", "Cash", "M-Pesa"];
        const saleStatuses: { status: any; txn: any }[] = [
          { status: "Paid", txn: "Completed" }, { status: "Paid", txn: "Completed" },
          { status: "Paid", txn: "Completed" }, { status: "Partially Paid", txn: "Completed" },
          { status: "Paid", txn: "Completed" }, { status: "Paid", txn: "Voided" },
          { status: "Paid", txn: "Refunded" }, { status: "Paid", txn: "Completed" },
          { status: "Paid", txn: "Completed" }, { status: "Paid", txn: "Completed" },
        ];

        for (let i = 0; i < saleStatuses.length; i++) {
          const svc = pick(services, i + 3);
          const custIdx = i % customerIds.length;
          const saleDate = new Date(now);
          saleDate.setDate(saleDate.getDate() - i);
          const { status, txn } = saleStatuses[i];

          const items: any[] = [{
            id: `demo-svc-${i}`, type: "Service", serviceId: svc.id, name: svc.name,
            price: svc.price, quantity: 1, staffId: staffIds[i % staffIds.length],
            staffName: staffSeeds[i % staffIds.length].name, discount: 0, total: svc.price,
          }];

          // Every third sale also includes a retail product line, so
          // Reports/Transactions show mixed-cart sales too.
          if (i % 3 === 0 && inventoryIds.length > 0) {
            const invIdx = i % inventorySeeds.length;
            const product = inventorySeeds[invIdx];
            items.push({
              id: `demo-prod-${i}`, type: "Product", productId: inventoryIds[invIdx], name: product.name,
              price: product.sellingPrice || product.costPrice, quantity: 1, discount: 0,
              total: product.sellingPrice || product.costPrice,
            });
          }

          const subtotal = items.reduce((s, it) => s + it.total, 0);
          const totalPaid = status === "Partially Paid" ? Math.round(subtotal * 0.5) : subtotal;
          const balance = subtotal - totalPaid;
          const receiptNumber = `DEMO-${Date.now().toString().slice(-8)}${i}`;

          await db.sales.add({
            receiptNumber,
            customerId: customerIds[custIdx],
            customerName: customerSeeds[custIdx].name,
            items,
            subtotal,
            discount: 0,
            tax: 0,
            total: subtotal,
            totalPaid,
            balance,
            status,
            transactionStatus: txn,
            payments: [{ method: paymentMethods[i % paymentMethods.length], amount: totalPaid, date: saleDate }],
            cashierId: String(cashierUserId),
            cashierName: "demo.cashier",
            isDemo: true,
            createdAt: saleDate,
            updatedAt: saleDate,
            ...(txn === "Voided" ? { voidReason: "Customer changed mind", voidedAt: saleDate, voidedBy: "Demo Admin" } : {}),
            ...(txn === "Refunded" ? { refundAmount: subtotal, refundReason: "Service not satisfactory", refundedAt: saleDate, refundedBy: "Demo Admin" } : {}),
          } as any);
          counts.sales++;
        }
      }

      // --- Cash Drawer ------------------------------------------------------
      const drawerId = await db.cashDrawers.add({
        status: "Open",
        openedAt: now,
        openingBalance: 5000,
        openedBy: "demo.cashier",
        isDemo: true,
      } as any);

      const movementSeeds = [
        { type: "IN", amount: 12500, reason: "Cash sales for the morning shift" },
        { type: "OUT", amount: 2000, reason: "Petty cash payout - supplies" },
        { type: "IN", amount: 4300, reason: "Cash sales - afternoon" },
      ];
      for (const m of movementSeeds) {
        await db.cashMovements.add({
          drawerId, type: m.type, amount: m.amount, reason: m.reason, date: now,
          username: "demo.cashier", isDemo: true,
        } as any);
        counts.cashMovements++;
      }

      // --- Held sales (parked checkouts) -------------------------------------
      if (services.length > 0) {
        const heldSeeds = [0, 1];
        for (const i of heldSeeds) {
          const svc = pick(services, i + 5);
          await db.heldSales.add({
            holdId: `HOLD-${Date.now()}-${i}`,
            customerId: customerIds[i],
            customerName: customerSeeds[i].name,
            cart: [{ id: `held-${i}`, type: "Service", serviceId: svc.id, name: svc.name, price: svc.price, quantity: 1, discount: 0, total: svc.price }],
            payments: [],
            discount: 0,
            tip: 0,
            cashierId: String(cashierUserId),
            cashierName: "demo.cashier",
            isDemo: true,
            createdAt: now,
          } as any);
          counts.heldSales++;
        }
      }

      // --- Audit log entries --------------------------------------------------
      const auditSeeds = [
        { user: "Demo Admin", action: "DEMO DATA", details: "Loaded full demo dataset for testing" },
        { user: "demo.supervisor", action: "BOOKING", details: "Reviewed today's appointment schedule" },
        { user: "demo.cashier", action: "POS SALE", details: "Processed a walk-in sale at the front desk" },
      ];
      for (const a of auditSeeds) {
        await db.auditLogs.add({
          userId: "0", username: a.user, action: a.action, details: a.details, timestamp: now, isDemo: true,
        } as any);
        counts.auditLogs++;
      }
    }
  );

  return counts;
}

// Deletes every record seedDemoData() created (isDemo: true) across every
// table it touched — customers, clinical records, bookings, sales, staff,
// commissions, packages, memberships, vouchers, promotions, expenses,
// suppliers, purchase orders, leave, attendance, loyalty history, demo
// login accounts, inventory + movements, cash drawer activity, held
// sales, and demo audit log lines — leaving the real service catalog,
// settings (including loyalty program settings), and the real admin
// account untouched.
export async function clearDemoData() {
  await db.transaction(
    "rw",
    [
      db.customers, db.clinicalRecords, db.bookings, db.sales, db.moduleRecords,
      db.inventory, db.inventoryMovements, db.cashDrawers, db.cashMovements,
      db.heldSales, db.users, db.auditLogs,
    ],
    async () => {
      await db.customers.filter((c: any) => c.isDemo === true).delete();
      await db.clinicalRecords.filter((r: any) => r.isDemo === true).delete();
      await db.bookings.filter((b: any) => b.isDemo === true).delete();
      await db.sales.filter((s: any) => s.isDemo === true).delete();
      await db.moduleRecords.filter((r: any) => r.isDemo === true).delete();
      await db.inventory.filter((i: any) => i.isDemo === true).delete();
      await db.inventoryMovements.filter((m: any) => m.isDemo === true).delete();
      await db.cashDrawers.filter((d: any) => d.isDemo === true).delete();
      await db.cashMovements.filter((m: any) => m.isDemo === true).delete();
      await db.heldSales.filter((h: any) => h.isDemo === true).delete();
      await db.users.filter((u: any) => u.isDemo === true).delete();
      await db.auditLogs.filter((a: any) => a.isDemo === true).delete();
    }
  );
}
