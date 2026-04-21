"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useVendorBranches } from "@/modules/dashboard/settings/branches/vendor-branches-context";
import {
  DEVICE_KIND_OPTIONS,
  emptyVendorDevice,
  labelForDeviceKind,
  type DeviceKind,
  type VendorDevice,
} from "@/modules/dashboard/settings/devices/device-types";

function deviceSummary(d: VendorDevice, index: number): string {
  const name = d.displayName.trim();
  const kind = labelForDeviceKind(d.kind);
  if (name.length > 0) return `${kind} · ${name}`;
  return `${kind} · Device ${index + 1}`;
}

export function DevicesSettingsForm() {
  const listId = useId();
  const nextSeq = useRef(1);
  const { branches } = useVendorBranches();

  const [devices, setDevices] = useState<VendorDevice[]>(() => [emptyVendorDevice(`${listId}-d0`)]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const updateDevice = useCallback((id: string, patch: Partial<VendorDevice>) => {
    setDevices((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addDevice = useCallback(() => {
    const id = `${listId}-d${nextSeq.current++}`;
    setDevices((rows) => [...rows, emptyVendorDevice(id)]);
    setExpandedId(id);
  }, [listId]);

  const removeDevice = useCallback((id: string) => {
    setDevices((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.id !== id)));
    setExpandedId((cur) => (cur === id ? null : cur));
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavedHint("Draft saved locally — device pairing and drivers connect when your workspace API is wired.");
    window.setTimeout(() => setSavedHint(null), 4000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="vendor-panel rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Hardware for this workspace</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          Register each printer, scanner, drawer, pole display, and payment device you plan to use with seiGEN. Name
          them clearly and tie them to a branch or register so staff pick the right unit at checkout or in the stock
          room.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-400">
          <li>Receipt, label, and barcode printers</li>
          <li>Cash drawers</li>
          <li>Barcode scanners (POS) and inventory scanners (receiving / counts)</li>
          <li>Pole or customer-facing displays</li>
          <li>Payment terminals, scales, and other peripherals</li>
        </ul>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Your devices</h2>
        <button
          type="button"
          onClick={addDevice}
          className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-teal-500 hover:text-teal-600"
        >
          Add device
        </button>
      </div>

      <div className="space-y-3">
        {devices.map((d, index) => {
          const open = expandedId === d.id;
          return (
            <div
              key={d.id}
              className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.03] shadow-sm"
            >
              <button
                type="button"
                onClick={() => setExpandedId(open ? null : d.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.06]"
              >
                <span className="text-sm font-medium text-white">{deviceSummary(d, index)}</span>
                <span className="shrink-0 text-xs text-neutral-500">{open ? "Hide" : "Configure"}</span>
              </button>
              {open ? (
                <div className="space-y-4 border-t border-white/10 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-200">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-teal-600"
                        checked={d.enabled}
                        onChange={(e) => updateDevice(d.id, { enabled: e.target.checked })}
                      />
                      Enabled for this app
                    </label>
                    <button
                      type="button"
                      onClick={() => removeDevice(d.id)}
                      disabled={devices.length <= 1}
                      className="text-xs font-semibold text-red-300/90 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-200" htmlFor={`dev-kind-${d.id}`}>
                      Device type
                    </label>
                    <select
                      id={`dev-kind-${d.id}`}
                      value={d.kind}
                      onChange={(e) => updateDevice(d.id, { kind: e.target.value as DeviceKind })}
                      className="vendor-field mt-1 w-full max-w-lg rounded-lg px-3 py-2 text-sm"
                    >
                      {DEVICE_KIND_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-neutral-500">
                      {DEVICE_KIND_OPTIONS.find((o) => o.id === d.kind)?.description}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-neutral-200" htmlFor={`dev-name-${d.id}`}>
                        Display name
                      </label>
                      <input
                        id={`dev-name-${d.id}`}
                        value={d.displayName}
                        onChange={(e) => updateDevice(d.id, { displayName: e.target.value })}
                        className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                        placeholder="e.g. Counter 1 receipt printer"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-200" htmlFor={`dev-branch-${d.id}`}>
                        Branch (optional)
                      </label>
                      <select
                        id={`dev-branch-${d.id}`}
                        value={d.branchId}
                        onChange={(e) => updateDevice(d.id, { branchId: e.target.value })}
                        className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Not assigned to a branch</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {(b.shopName.trim() || "Unnamed shop") +
                              (b.city.trim() ? ` — ${b.city.trim()}` : "")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-neutral-200" htmlFor={`dev-reg-${d.id}`}>
                        Register / station
                      </label>
                      <input
                        id={`dev-reg-${d.id}`}
                        value={d.registerOrStation}
                        onChange={(e) => updateDevice(d.id, { registerOrStation: e.target.value })}
                        className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                        placeholder="e.g. Till 2, Back office PC"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-200" htmlFor={`dev-conn-${d.id}`}>
                        Connection (summary)
                      </label>
                      <input
                        id={`dev-conn-${d.id}`}
                        value={d.connectionSummary}
                        onChange={(e) => updateDevice(d.id, { connectionSummary: e.target.value })}
                        className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                        placeholder="e.g. USB · 192.168.1.40 · Bluetooth paired"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-200" htmlFor={`dev-notes-${d.id}`}>
                      Notes
                    </label>
                    <textarea
                      id={`dev-notes-${d.id}`}
                      value={d.notes}
                      onChange={(e) => updateDevice(d.id, { notes: e.target.value })}
                      rows={3}
                      className="vendor-field mt-1 w-full resize-y rounded-lg px-3 py-2 text-sm"
                      placeholder="Model, serial, driver name, or pairing instructions for IT support."
                    />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="vendor-panel-soft rounded-2xl px-5 py-4 text-sm text-neutral-300">
        <p className="font-medium text-white">POS &amp; inventory</p>
        <p className="mt-1 text-neutral-400">
          The app will use this list to show only relevant hardware when you print receipts, open the drawer, scan
          items, or show totals on a pole display. Deep discovery and driver install happen on the device agent or
          browser extension when that layer is enabled.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-95"
        >
          Save draft
        </button>
        {savedHint ? <p className="text-sm text-neutral-400">{savedHint}</p> : null}
      </div>
    </form>
  );
}
