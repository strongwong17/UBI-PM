"use client";

import { useEffect } from "react";
import { useContractStore } from "@/lib/contract-store";

export default function ContractStoreInitializer() {
  const initDefaults = useContractStore((s) => s.initDefaults);

  useEffect(() => {
    initDefaults();
  }, [initDefaults]);

  return null;
}
