"use client";

import {
  personaInputSchema,
  type ApiError,
  type ApiSuccess,
  type PaginationMeta,
  type Persona,
  type PersonaInput
} from "@tablia/shared";
import { useCallback, useEffect, useState, type FormEvent } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:3001" : "");
const emptyForm: PersonaInput = {
  nombreCompleto: "",
  rfc: "",
  correoElectronico: "",
  codigoPostal: ""
};

type FormErrors = Partial<Record<keyof PersonaInput, string>>;

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });
  const payload = (await response.json()) as ApiSuccess<T> | ApiError;
  if (!response.ok || !payload.success) {
    throw new Error(
      payload.success ? "La solicitud no pudo completarse" : payload.error.message
    );
  }
  return payload.data;
}

export function PersonasDashboard() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Persona | null>(null);
  const [form, setForm] = useState<PersonaInput>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  const loadPersonas = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE}/api/personas?search=${encodeURIComponent(search)}&page=${page}&limit=10`
      );
      const payload = (await response.json()) as ApiSuccess<Persona[]> | ApiError;
      if (!response.ok || !payload.success) {
        throw new Error(
          payload.success ? "No fue posible consultar las personas" : payload.error.message
        );
      }
      setPersonas(payload.data);
      if (payload.meta) setMeta(payload.meta);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = window.setTimeout(loadPersonas, 250);
    return () => window.clearTimeout(timer);
  }, [loadPersonas]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormErrors({});
    setModalOpen(true);
  }

  function openEdit(persona: Persona) {
    setEditing(persona);
    setForm({
      nombreCompleto: persona.nombreCompleto,
      rfc: persona.rfc,
      correoElectronico: persona.correoElectronico,
      codigoPostal: persona.codigoPostal
    });
    setFormErrors({});
    setModalOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const parsed = personaInputSchema.safeParse(form);
    if (!parsed.success) {
      const nextErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof PersonaInput | undefined;
        if (field && !nextErrors[field]) nextErrors[field] = issue.message;
      }
      setFormErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      await apiRequest<Persona>(
        editing ? `/api/personas/${editing.id}` : "/api/personas",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(parsed.data)
        }
      );
      setModalOpen(false);
      setMessage(editing ? "Persona actualizada correctamente" : "Persona creada correctamente");
      await loadPersonas();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible guardar");
    } finally {
      setSaving(false);
    }
  }

  async function remove(persona: Persona) {
    if (!window.confirm(`¿Eliminar a ${persona.nombreCompleto}?`)) return;
    setError("");
    try {
      await apiRequest<{ id: number }>(`/api/personas/${persona.id}`, {
        method: "DELETE"
      });
      setMessage("Persona eliminada correctamente");
      if (personas.length === 1 && page > 1) setPage(page - 1);
      else await loadPersonas();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "No fue posible eliminar");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.22em] text-teal-700">
            Tablia
          </p>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">
            Personas
          </h1>
          <p className="mt-2 max-w-xl text-slate-600">
            Administra información fiscal y de contacto desde un solo lugar.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-xl bg-teal-700 px-5 py-3 font-bold text-white shadow-lg shadow-teal-900/10 transition hover:bg-teal-800"
        >
          + Nueva persona
        </button>
      </header>

      {(message || error) && (
        <div
          role="status"
          className={`mb-5 rounded-xl border px-4 py-3 ${
            error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {error || message}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full max-w-md">
            <span className="sr-only">Buscar personas</span>
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nombre, RFC o correo…"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm focus:border-teal-600"
            />
          </label>
          <p className="text-sm font-medium text-slate-500">
            {meta.total} {meta.total === 1 ? "registro" : "registros"}
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Cargando personas…</div>
        ) : personas.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-lg font-bold text-slate-800">No hay personas para mostrar</p>
            <p className="mt-1 text-sm text-slate-500">
              {search ? "Prueba con otra búsqueda." : "Crea el primer registro para comenzar."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-4">Nombre</th>
                  <th className="px-5 py-4">RFC</th>
                  <th className="px-5 py-4">Correo</th>
                  <th className="px-5 py-4">C.P.</th>
                  <th className="px-5 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {personas.map((persona) => (
                  <tr key={persona.id} className="hover:bg-teal-50/40">
                    <td className="px-5 py-4 font-bold text-slate-900">
                      {persona.nombreCompleto}
                    </td>
                    <td className="px-5 py-4 font-mono text-sm text-slate-700">
                      {persona.rfc}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {persona.correoElectronico}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{persona.codigoPostal}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => openEdit(persona)}
                        className="mr-2 rounded-lg px-3 py-2 text-sm font-bold text-teal-700 hover:bg-teal-100"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => remove(persona)}
                        className="rounded-lg px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 p-5">
            <button
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-sm text-slate-600">
              Página {meta.page} de {meta.totalPages}
            </span>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        )}
      </section>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="form-title"
        >
          <form
            onSubmit={submit}
            className="max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-teal-700">
                  {editing ? "Editar registro" : "Nuevo registro"}
                </p>
                <h2 id="form-title" className="mt-1 text-2xl font-black text-slate-900">
                  {editing ? editing.nombreCompleto : "Agregar persona"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Cerrar formulario"
                className="rounded-lg p-2 text-xl text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <div className="grid gap-5">
              {(
                [
                  ["nombreCompleto", "Nombre completo", "María López García"],
                  ["rfc", "RFC", "LOGM900101ABC"],
                  ["correoElectronico", "Correo electrónico", "maria@example.com"],
                  ["codigoPostal", "Código postal", "86000"]
                ] as const
              ).map(([field, label, placeholder]) => (
                <label key={field} className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700">{label}</span>
                  <input
                    name={field}
                    value={form[field]}
                    placeholder={placeholder}
                    maxLength={field === "codigoPostal" ? 5 : undefined}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [field]: event.target.value
                      }))
                    }
                    className={`rounded-xl border bg-slate-50 px-4 py-3 ${
                      formErrors[field] ? "border-red-400" : "border-slate-300"
                    }`}
                  />
                  {formErrors[field] && (
                    <span className="text-sm text-red-700">{formErrors[field]}</span>
                  )}
                </label>
              ))}
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-teal-700 px-5 py-3 font-bold text-white disabled:opacity-60"
              >
                {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear persona"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
