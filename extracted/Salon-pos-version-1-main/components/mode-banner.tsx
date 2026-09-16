"use client";

import React, { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import { isTrainingMode } from "@/lib/app-mode";

// Persistent strip shown everywhere (login, setup, and every app page)
// whenever the Training environment is active, so nobody can mistake
// a training session for the real system, or vice versa.
export function ModeBanner() {
  const [training, setTraining] = useState(false);

  useEffect(() => {
    setTraining(isTrainingMode());
  }, []);

  if (!training) return null;

  return (
    <div className="w-full bg-amber-400 text-amber-950 text-center py-2 px-4 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest sticky top-0 z-[999] shadow-md">
      <GraduationCap size={16} />
      Training Mode — practice data only, not connected to the real salon
    </div>
  );
}

export default ModeBanner;
