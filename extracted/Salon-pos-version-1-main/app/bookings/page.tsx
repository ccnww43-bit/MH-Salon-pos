"use client";

import { FormEvent, useEffect, useState } from "react";
import { db, Booking, Customer, Service, ModuleRecord } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { Pagination } from "@/components/pagination";
import { Navbar } from "@/components/navbar";

const statuses = [
  "Booked",
  "Confirmed",
  "Waiting",
  "In Progress",
  "Completed",
  "Cancelled",
  "No Show",
] as const;

export default function BookingsPage() {
  const [role, setRole] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<ModuleRecord[]>([]);
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [editing, setEditing] = useState<number | null>(null);

  // Pagination — mirrors the pattern used on the Customers page. The
  // schedule is also now fetched one day at a time (see load()) instead of
  // loading every appointment ever created, so this only ever paginates the
  // selected day's bookings.
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const [form, setForm] = useState({
    customerId: "",
    type: "Appointment",
    startTime: "09:00",
    endTime: "10:00",
    serviceIds: [] as number[],
    staffId: "",
    status: "Booked",
    notes: "",
  });

  const load = async () => {
    // FIX: only fetch bookings for the selected date (using the indexed
    // bookingDate field) instead of db.bookings.toArray(), which pulled
    // every appointment ever created — going back to day one — on every
    // visit to this page.
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59.999`);

    setBookings(
      await db.bookings
        .where("bookingDate")
        .between(dayStart, dayEnd, true, true)
        .toArray()
    );

    setCustomers(await db.customers.toArray());

    setServices(
      (await db.services.toArray()).filter(
        (s) => s.isActive !== false
      )
    );

    // Staff = the employee directory (db.moduleRecords, module 'staff') —
    // the same source POS checkout and Commissions use to assign who
    // performed a service. This is deliberately NOT db.users (login
    // accounts/roles); those are two separate things in this system.
    setStaff(
      (await db.moduleRecords.where("module").equals("staff").toArray()).filter(
        (s) => s.status === "Active"
      )
    );
  };

  useEffect(() => {
    setRole(localStorage.getItem("userRole"));
  }, []);

  // Reload whenever the selected date changes, since load() now scopes its
  // query to that date. Also jump back to page 1 so the user isn't
  // stranded on a now out-of-range page for the new day.
  useEffect(() => {
    setPage(1);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  if (!hasPermission(role, "view_bookings")) {
    return (
      <>
      <Navbar />
      <div className="page-shell flex items-center justify-center min-h-[60vh]">
        <div className="gloss-card p-8 text-center max-w-lg">
          <h1 className="page-title text-xl">Access denied</h1>
          <p className="page-subtitle">You don't have permission to view this page.</p>
        </div>
      </div>
      </>
    );
  }

  const save = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.customerId || !form.serviceIds.length) {
      return alert(
        "Select a customer and at least one service."
      );
    }

    const c = customers.find(
      (x) => String(x.id) === form.customerId
    );

    if (!c || c.id === undefined) {
      return alert("The selected customer could not be found.");
    }

    const st = staff.find(
      (x) => String(x.id) === form.staffId
    );

    const sv = form.serviceIds.map((id) => {
      const s = services.find((x) => x.id === id)!;

      return {
        serviceId: s.id!,
        name: s.name,
        price: s.price,
        staffId: st?.id,
      };
    });

    const now = new Date();

    const data: Booking = {
      customerId: c.id,
      customerName: c.name || "",
      type: form.type as any,
      status: form.status as any,
      bookingDate: new Date(
        `${date}T${form.startTime}:00`
      ),
      startTime: form.startTime,
      endTime: form.endTime,
      services: sv,
      staffId: st?.id,
      staffName: st?.title,
      notes: form.notes,
      createdBy:
        localStorage.getItem("username") || "unknown",
      createdAt: now,
      updatedAt: now,
    };

    if (editing) {
      await db.bookings.update(editing, data as any);

      await db.auditLogs.add({
        userId:
          localStorage.getItem("username") || "unknown",
        username:
          localStorage.getItem("username") || "unknown",
        action: "EDIT_BOOKING",
        details: `Updated booking for ${data.customerName}`,
        timestamp: now,
      });
    } else {
      await db.bookings.add(data);

      await db.auditLogs.add({
        userId:
          localStorage.getItem("username") || "unknown",
        username:
          localStorage.getItem("username") || "unknown",
        action: "CREATE_BOOKING",
        details: `Created booking for ${data.customerName}`,
        timestamp: now,
      });
    }

    setEditing(null);

    setForm({
      customerId: "",
      type: "Appointment",
      startTime: "09:00",
      endTime: "10:00",
      serviceIds: [],
      staffId: "",
      status: "Booked",
      notes: "",
    });

    load();
  };

  const edit = (b: Booking) => {
    setEditing(b.id!);

    setDate(
      new Date(b.bookingDate)
        .toISOString()
        .slice(0, 10)
    );

    setForm({
      customerId: String(b.customerId || ""),
      type: b.type,
      startTime: b.startTime,
      endTime: b.endTime || "",
      serviceIds: b.services
        .map((s) => Number(s.serviceId))
        .filter(Boolean),
      staffId: String(b.staffId || ""),
      status: b.status,
      notes: b.notes || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const status = async (
    b: Booking,
    s: (typeof statuses)[number]
  ) => {
    if (!b.id) return;

    await db.bookings.update(b.id, {
      status: s,
      updatedAt: new Date(),
      ...(s === "Completed"
        ? { completedAt: new Date() }
        : {}),
      ...(s === "Cancelled"
        ? {
            cancelledAt: new Date(),
            cancelledBy:
              localStorage.getItem("username") ||
              "unknown",
          }
        : {}),
    } as any);

    await db.auditLogs.add({
      userId:
        localStorage.getItem("username") || "unknown",
      username:
        localStorage.getItem("username") || "unknown",
      action: `BOOKING_${s
        .toUpperCase()
        .replaceAll(" ", "_")}`,
      details: `Booking #${b.id} ${b.customerName}`,
      timestamp: new Date(),
    });

    load();
  };

  // bookings is already scoped to the selected date by load(), so this just
  // sorts it for display.
  const day = [...bookings].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  const paginatedDay = day.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  return (
    <>
    <Navbar />
    <div className="page-shell space-y-6">
      <div>
        <h1 className="page-title">
          Bookings & Appointments
        </h1>

        <p className="text-gray-500">
          Walk-ins, appointments, scheduling and service
          status.
        </p>
      </div>

      <form
        onSubmit={save}
        className="bg-white border rounded-2xl p-5 grid md:grid-cols-4 gap-4"
      >
        <div>
          <label className="text-sm font-semibold">
            Customer
          </label>

          <select
            value={form.customerId}
            onChange={(e) =>
              setForm({
                ...form,
                customerId: e.target.value,
              })
            }
            className="w-full border rounded-xl p-3 mt-1"
          >
            <option value="">
              Select customer
            </option>

            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{" "}
                {c.phone && `— ${c.phone}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold">
            Type
          </label>

          <select
            value={form.type}
            onChange={(e) =>
              setForm({
                ...form,
                type: e.target.value,
              })
            }
            className="w-full border rounded-xl p-3 mt-1"
          >
            <option>Appointment</option>
            <option>Walk-in</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold">
            Date
          </label>

          <input
            type="date"
            value={date}
            onChange={(e) =>
              setDate(e.target.value)
            }
            className="w-full border rounded-xl p-3 mt-1"
          />
        </div>

        <div>
          <label className="text-sm font-semibold">
            Status
          </label>

          <select
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value,
              })
            }
            className="w-full border rounded-xl p-3 mt-1"
          >
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold">
            Start
          </label>

          <input
            type="time"
            value={form.startTime}
            onChange={(e) =>
              setForm({
                ...form,
                startTime: e.target.value,
              })
            }
            className="w-full border rounded-xl p-3 mt-1"
          />
        </div>

        <div>
          <label className="text-sm font-semibold">
            End
          </label>

          <input
            type="time"
            value={form.endTime}
            onChange={(e) =>
              setForm({
                ...form,
                endTime: e.target.value,
              })
            }
            className="w-full border rounded-xl p-3 mt-1"
          />
        </div>

        <div>
          <label className="text-sm font-semibold">
            Staff
          </label>

          <select
            value={form.staffId}
            onChange={(e) =>
              setForm({
                ...form,
                staffId: e.target.value,
              })
            }
            className="w-full border rounded-xl p-3 mt-1"
          >
            <option value="">
              Unassigned
            </option>

            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
                {s.data?.position ? ` (${s.data.position})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold">
            Services
          </label>

          <select
            multiple
            value={form.serviceIds.map(String)}
            onChange={(e) =>
              setForm({
                ...form,
                serviceIds: Array.from(
                  e.target.selectedOptions
                ).map((o) => Number(o.value)),
              })
            }
            className="w-full border rounded-xl p-3 mt-1 h-28"
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.price}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-4">
          <label className="text-sm font-semibold">
            Notes
          </label>

          <textarea
            value={form.notes}
            onChange={(e) =>
              setForm({
                ...form,
                notes: e.target.value,
              })
            }
            className="w-full border rounded-xl p-3 mt-1"
          />
        </div>

        <div className="md:col-span-4 flex gap-2">
          <button className="bg-primary text-white rounded-xl px-5 py-3 font-bold">
            {editing
              ? "Update Booking"
              : "Create Booking"}
          </button>

          {editing && (
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="border rounded-xl px-5 py-3"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="flex items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) =>
            setDate(e.target.value)
          }
          className="border rounded-xl p-3"
        />

        <span className="font-bold">
          Daily schedule
        </span>
      </div>

      <div className="bg-white border rounded-2xl divide-y">
        {day.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No bookings for this date.
          </div>
        ) : (
          paginatedDay.map((b) => (
            <div
              key={b.id}
              className="p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4"
            >
              <div>
                <div className="font-black text-lg">
                  {b.startTime} — {b.customerName}
                </div>

                <div className="text-sm text-gray-500">
                  {b.type} •{" "}
                  {b.staffName || "No staff"} •{" "}
                  {b.services
                    .map((s) => s.name)
                    .join(", ")}
                </div>

                {b.notes && (
                  <div className="text-sm mt-1">
                    {b.notes}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={b.status}
                  onChange={(e) =>
                    status(
                      b,
                      e.target.value as (typeof statuses)[number]
                    )
                  }
                  className="border rounded-lg p-2"
                >
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>

                <button
                  onClick={() => edit(b)}
                  className="border rounded-lg px-3 py-2"
                >
                  Edit
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination
        totalItems={day.length}
        itemsPerPage={PAGE_SIZE}
        currentPage={page}
        onPageChange={setPage}
      />
    </div>
    </>
  );
}
