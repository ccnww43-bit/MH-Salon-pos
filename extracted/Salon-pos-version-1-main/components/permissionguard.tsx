"use client";

import React, {
  ReactNode,
  useEffect,
  useState,
} from "react";
import { hasPermission } from "@/lib/permissions";
import { Permission } from "@/lib/db";

interface PermissionGuardProps {
  permission: Permission | string;
  children: ReactNode;
  fallback?: ReactNode;
}

function PermissionGuard({
  permission,
  children,
  fallback = null,
}: PermissionGuardProps) {
  const [allowed, setAllowed] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const role =
      localStorage.getItem("userRole");

    let customPermissions:
      | Permission[]
      | undefined;

    try {
      const saved =
        localStorage.getItem(
          "userPermissions"
        );

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          customPermissions = parsed;
        }
      }
    } catch {
      customPermissions = undefined;
    }

    setAllowed(
      hasPermission(
        role,
        permission,
        customPermissions
      )
    );
  }, [permission]);

  if (allowed === null) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-[24px] border border-white/80 bg-white/50">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export { PermissionGuard };

export default PermissionGuard;
