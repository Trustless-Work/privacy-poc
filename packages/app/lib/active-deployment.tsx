"use client";

/**
 * Tracks which deployment the app is serving and persists the user-created
 * "advanced" one in localStorage.
 *
 * Two slots only (per product decision): the built-in {@link DEFAULT_DEPLOYMENT}
 * and a single "advanced" deployment created by the advanced-mode wizard.
 * Deploying a new confidential token overwrites the advanced slot. The selector
 * in the nav toggles which one is active; every persona page reads
 * {@link useActiveDeployment}().active and builds its ChainClient / wallet from
 * it, so switching rewires the whole app.
 *
 * Hydration: the provider renders the default on the server and on first client
 * paint, then restores the persisted choice in an effect. A brief flash to the
 * advanced deployment is acceptable for the demo and avoids an SSR mismatch.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_DEPLOYMENT, type Deployment } from "./deployment";

const ADVANCED_KEY = "ctd:advanced:deployment";
const ACTIVE_KEY = "ctd:active"; // "default" | "advanced"
const LEGACY_ESCROWS_KEY = "ctd:escrows"; // confidential-token id -> active escrow id
const ESCROWS_KEY = "ctd:escrows:v2"; // confidential-token id -> known escrow ids
const SELECTED_ESCROWS_KEY = "ctd:selected-escrows"; // confidential-token id -> selected escrow id

type Which = "default" | "advanced";

interface ActiveDeploymentCtx {
  /** The deployment currently in effect (default unless advanced is active). */
  active: Deployment;
  /** The saved advanced deployment, or null if none has been created. */
  advanced: Deployment | null;
  which: Which;
  /** Switch the active slot (no-op to "advanced" when none exists). */
  setWhich: (w: Which) => void;
  /** Persist a freshly-deployed advanced deployment and switch to it. */
  saveAdvanced: (d: Deployment) => void;
  /** Forget the advanced deployment and fall back to the default. */
  clearAdvanced: () => void;
  /** Select the newly-created escrow for every role page in this deployment. */
  setActiveEscrow: (contractId: string) => void;
  /** Every escrow created or selected in the active token deployment. */
  escrows: string[];
}

const Ctx = createContext<ActiveDeploymentCtx | null>(null);

function loadAdvanced(): Deployment | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(ADVANCED_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Deployment;
  } catch {
    return null;
  }
}

export function ActiveDeploymentProvider({ children }: { children: React.ReactNode }) {
  const [advanced, setAdvanced] = useState<Deployment | null>(null);
  const [which, setWhichState] = useState<Which>("default");
  const [escrowsByToken, setEscrowsByToken] = useState<Record<string, string[]>>({});
  const [selectedByToken, setSelectedByToken] = useState<Record<string, string>>({});

  useEffect(() => {
    const adv = loadAdvanced();
    if (adv) setAdvanced(adv);
    if (localStorage.getItem(ACTIVE_KEY) === "advanced" && adv) setWhichState("advanced");
    try {
      const saved = JSON.parse(localStorage.getItem(ESCROWS_KEY) || "{}") as Record<string, string[]>;
      const selected = JSON.parse(localStorage.getItem(SELECTED_ESCROWS_KEY) || "{}") as Record<string, string>;
      const legacy = JSON.parse(localStorage.getItem(LEGACY_ESCROWS_KEY) || "{}") as Record<string, string>;
      for (const [token, escrow] of Object.entries(legacy)) {
        if (!saved[token]?.includes(escrow)) saved[token] = [...(saved[token] || []), escrow];
        if (!selected[token]) selected[token] = escrow;
      }
      setEscrowsByToken(saved);
      setSelectedByToken(selected);
      localStorage.setItem(ESCROWS_KEY, JSON.stringify(saved));
      localStorage.setItem(SELECTED_ESCROWS_KEY, JSON.stringify(selected));
    } catch {
      setEscrowsByToken({});
      setSelectedByToken({});
    }
  }, []);

  const setWhich = useCallback((w: Which) => {
    setWhichState(w);
    try {
      localStorage.setItem(ACTIVE_KEY, w);
    } catch {
      /* ignore */
    }
  }, []);

  const saveAdvanced = useCallback((d: Deployment) => {
    try {
      localStorage.setItem(ADVANCED_KEY, JSON.stringify(d));
      localStorage.setItem(ACTIVE_KEY, "advanced");
    } catch {
      /* ignore */
    }
    setAdvanced(d);
    setWhichState("advanced");
  }, []);

  const clearAdvanced = useCallback(() => {
    try {
      localStorage.removeItem(ADVANCED_KEY);
      localStorage.setItem(ACTIVE_KEY, "default");
    } catch {
      /* ignore */
    }
    setAdvanced(null);
    setWhichState("default");
  }, []);

  const baseActive = which === "advanced" && advanced ? advanced : DEFAULT_DEPLOYMENT;
  const savedEscrows = escrowsByToken[baseActive.contracts.token] || [];
  const tokenEscrows = baseActive.contracts.escrow && !savedEscrows.includes(baseActive.contracts.escrow)
    ? [baseActive.contracts.escrow, ...savedEscrows]
    : savedEscrows;
  const selectedEscrow = selectedByToken[baseActive.contracts.token]
    || tokenEscrows.at(-1)
    || baseActive.contracts.escrow;
  const active = useMemo<Deployment>(() => selectedEscrow
    ? { ...baseActive, contracts: { ...baseActive.contracts, escrow: selectedEscrow } }
    : baseActive, [baseActive, selectedEscrow]);

  const setActiveEscrow = useCallback((contractId: string) => {
    const token = baseActive.contracts.token;
    setEscrowsByToken((current) => {
      const existing = current[token] || [];
      const next = existing.includes(contractId)
        ? current
        : { ...current, [token]: [...existing, contractId] };
      try { localStorage.setItem(ESCROWS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setSelectedByToken((current) => {
      const next = { ...current, [token]: contractId };
      try { localStorage.setItem(SELECTED_ESCROWS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [baseActive.contracts.token]);

  return (
    <Ctx.Provider value={{ active, advanced, which, setWhich, saveAdvanced, clearAdvanced, setActiveEscrow, escrows: tokenEscrows }}>
      {children}
    </Ctx.Provider>
  );
}

export function useActiveDeployment(): ActiveDeploymentCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActiveDeployment must be used within ActiveDeploymentProvider");
  return ctx;
}
