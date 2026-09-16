'use client';

import { FormEvent, useEffect, useState } from 'react';
import { db, ModuleName, ModuleRecord } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  X,
  AlertCircle,
} from 'lucide-react';
import { logAction } from '@/lib/logger';

export type Field = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea';
  options?: string[];
  required?: boolean;
};

interface ModuleCrudProps {
  module: ModuleName;
  title: string;
  permission: string;
  fields: Field[];
  description?: string;
}

export function ModuleCrud({
  module,
  title,
  permission,
  fields,
  description,
}: ModuleCrudProps) {
  const [role, setRole] = useState<string | null>(null);
  const [records, setRecords] = useState<ModuleRecord[]>([]);
  const [editing, setEditing] = useState<ModuleRecord | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await db.moduleRecords
        .where('module')
        .equals(module)
        .reverse()
        .sortBy('createdAt');

      setRecords(data);
    } catch (err) {
      console.error(err);
      setError('Unable to load records. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setRole(localStorage.getItem('userRole'));
    void load();
  }, [module]);

  if (!hasPermission(role, permission)) {
    return (
      <div className="min-h-[60vh] p-6 md:p-5">
        <div className="glass-panel mx-auto flex min-h-[420px] max-w-4xl items-center justify-center rounded-[32px] p-4 text-center md:rounded-[42px]">
          <div>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[20px] bg-red-50 text-red-500">
              <AlertCircle size={30} />
            </div>

            <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-xl">
              Access Restricted
            </h1>

            <p className="mx-auto mt-4 max-w-md text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Administrative clearance required for {title}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const openCreate = () => {
    setEditing(null);
    setForm({});
    setError(null);
    document.getElementById('crud-modal')?.classList.remove('hidden');
  };

  const openEdit = (record: ModuleRecord) => {
    setEditing(record);
    setForm(record.data || {});
    setError(null);
    document.getElementById('crud-modal')?.classList.remove('hidden');
  };

  const closeModal = () => {
    if (saving) return;

    document.getElementById('crud-modal')?.classList.add('hidden');
    setEditing(null);
    setForm({});
    setError(null);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();

    if (saving) return;

    try {
      setSaving(true);
      setError(null);

      const now = new Date();

      const titleValue =
        form.name ||
        form.title ||
        form.description ||
        form.customerName ||
        form.staffName ||
        `${title} record`;

      const data = { ...form };

      if (editing?.id) {
        await db.moduleRecords.update(editing.id, {
          title: titleValue,
          status: form.status || editing.status,
          data,
          updatedAt: now,
        });

        await logAction(
          'Management',
          `Modified ${title}: ${titleValue}`
        );
      } else {
        await db.moduleRecords.add({
          module,
          title: titleValue,
          status: form.status || 'Active',
          data,
          createdAt: now,
          updatedAt: now,
        });

        await logAction(
          'Management',
          `Created ${title}: ${titleValue}`
        );
      }

      closeModal();
      await load();
    } catch (err) {
      console.error(err);
      setError('Unable to save this record. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (record: ModuleRecord) => {
    if (
      !record.id ||
      !confirm(
        `Strict Authorization Required: Delete ${record.title}?`
      )
    ) {
      return;
    }

    try {
      setError(null);

      await db.moduleRecords.delete(record.id);

      await logAction(
        'Management',
        `Purged Record from ${title}: ${record.title}`
      );

      await load();
    } catch (err) {
      console.error(err);
      setError('Unable to delete this record. Please try again.');
    }
  };

  const filtered = records.filter((record) =>
    `${record.title} ${JSON.stringify(record.data)}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="min-h-full p-4 md:p-7 xl:p-5">
      <div className="mx-auto max-w-[1700px] space-y-7 md:space-y-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 text-[9px] font-black uppercase tracking-[0.22em] text-blue-600">
              MH Digital Salon POS
            </div>

            <h1 className="truncate text-lg font-black tracking-[-0.045em] text-slate-950 md:text-2xl">
              {title}
            </h1>

            {description && (
              <p className="mt-2 max-w-2xl text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {description}
              </p>
            )}
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <div className="relative min-w-0 flex-1 sm:min-w-[250px] lg:flex-none">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
                size={18}
              />

              <input
                placeholder="Search records..."
                className="h-[50px] w-full rounded-[17px] border border-white/90 bg-white/75 pl-11 pr-4 text-xs font-bold text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,.05)] outline-none transition-all placeholder:text-slate-400 focus:border-blue-200 focus:bg-white focus:ring-4 focus:ring-blue-500/10 sm:w-[280px]"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              onClick={openCreate}
              className="active-click flex h-[50px] items-center justify-center gap-2 rounded-[17px] bg-[#0b1422] px-6 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-[0_14px_30px_rgba(15,23,42,.18)] transition-all hover:bg-[#101d2e]"
            >
              <Plus size={17} />
              Add Entry
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-[18px] border border-red-100 bg-red-50 px-5 py-4 text-xs font-bold text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="h-[250px] animate-pulse rounded-[30px] border border-white bg-white/60"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-panel rounded-[30px] p-5 text-center md:rounded-[36px]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Search size={24} />
            </div>

            <h2 className="text-xl font-black tracking-tight text-slate-900">
              No records found
            </h2>

            <p className="mt-2 text-xs font-bold text-slate-400">
              {search
                ? 'Try a different search.'
                : `No ${title.toLowerCase()} records have been added yet.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((record) => (
              <div
                key={record.id}
                className="prestige-card hover-lift rounded-[30px] p-6 md:rounded-[34px] md:p-4"
              >
                <div className="relative z-10">
                  <div className="mb-7 flex items-start justify-between gap-4">
                    <span className="rounded-full bg-blue-50 px-4 py-2 text-[8px] font-black uppercase tracking-[0.16em] text-blue-600">
                      {record.status}
                    </span>

                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(record)}
                        className="active-click flex h-9 w-9 items-center justify-center rounded-xl border border-slate-100 bg-white text-blue-600 shadow-sm transition hover:shadow-md"
                        aria-label="Edit record"
                      >
                        <Edit3 size={15} />
                      </button>

                      <button
                        onClick={() => remove(record)}
                        className="active-click flex h-9 w-9 items-center justify-center rounded-xl border border-slate-100 bg-white text-red-500 shadow-sm transition hover:shadow-md"
                        aria-label="Delete record"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <h3 className="mb-7 break-words text-2xl font-black leading-tight tracking-[-0.035em] text-slate-950">
                    {record.title}
                  </h3>

                  <div className="grid grid-cols-2 gap-x-5 gap-y-5 border-t border-slate-100 pt-6">
                    {Object.entries(record.data || {})
                      .filter(
                        ([key]) =>
                          !['name', 'title', 'status'].includes(key)
                      )
                      .slice(0, 4)
                      .map(([key, value]) => (
                        <div key={key} className="min-w-0">
                          <div className="mb-1.5 truncate text-[8px] font-black uppercase tracking-[0.18em] text-slate-300">
                            {key}
                          </div>

                          <div className="truncate text-xs font-black text-slate-700">
                            {String(value)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        id="crud-modal"
        className="fixed inset-0 z-[100] hidden items-center justify-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-xl md:p-4"
      >
        <div className="relative my-auto w-full max-w-2xl overflow-hidden rounded-[30px] border border-white/90 bg-white p-6 shadow-[0_40px_100px_rgba(15,23,42,.3)] md:rounded-[40px] md:p-5">
          <button
            type="button"
            onClick={closeModal}
            className="active-click absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 md:right-7 md:top-7"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          <div className="pr-12">
            <div className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-blue-600">
              {editing ? 'Edit record' : 'New record'}
            </div>

            <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950 md:text-xl">
              {editing ? 'Override Entry' : 'Create Entry'}
            </h2>
          </div>

          <form onSubmit={save} className="mt-8 space-y-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {fields.map((field) => (
                <div
                  key={field.key}
                  className={
                    field.type === 'textarea'
                      ? 'md:col-span-2'
                      : ''
                  }
                >
                  <label className="mb-2 ml-1 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                    {field.label}
                    {field.required ? ' *' : ''}
                  </label>

                  {field.type === 'textarea' ? (
                    <textarea
                      required={field.required}
                      className="min-h-[130px] w-full resize-y rounded-[18px] border border-slate-100 bg-slate-50 p-4 text-xs font-bold text-slate-800 outline-none transition focus:border-blue-200 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                      value={form[field.key] || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [field.key]: e.target.value,
                        })
                      }
                    />
                  ) : field.type === 'select' ? (
                    <select
                      required={field.required}
                      className="h-[50px] w-full rounded-[16px] border border-slate-100 bg-slate-50 px-4 text-xs font-black text-slate-800 outline-none transition focus:border-blue-200 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                      value={form[field.key] || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [field.key]: e.target.value,
                        })
                      }
                    >
                      <option value="">Select Option</option>

                      {field.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required={field.required}
                      type={field.type || 'text'}
                      className="h-[50px] w-full rounded-[16px] border border-slate-100 bg-slate-50 px-4 text-xs font-bold text-slate-800 outline-none transition focus:border-blue-200 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                      value={form[field.key] || ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [field.key]: e.target.value,
                        })
                      }
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="active-click flex h-[56px] w-full items-center justify-center rounded-[18px] bg-[#0b1422] text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_16px_32px_rgba(15,23,42,.18)] transition hover:bg-[#101d2e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? 'Saving...'
                : editing
                  ? 'Save Changes'
                  : 'Create Entry'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
