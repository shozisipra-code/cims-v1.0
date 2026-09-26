"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { CurrentUser } from "@/types";

// A single-practitioner clinic has one active clinician. Replace these demo values
// with authenticated account data when sign-in is introduced.
export const CLINICIAN: CurrentUser = {
  id: "usr_doc_1",
  name: "Dr. Ayesha Khan, MBBS",
  email: "doctor@cims.clinic",
  role: "SUPER_USER",
  department: "General Practice",
  avatar: "",
  licenseNumber: "DEMO-PMDC-NOT-VALID",
  permissions: ["dashboard", "booking", "appointments", "patients", "clinical", "billing", "payments", "pharmacy", "users"],
};

const ClinicContext = createContext({ currentUser: CLINICIAN, ready: false, setCurrentUser: (_user: CurrentUser | null) => {} });

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setUser] = useState(CLINICIAN);
  const [ready, setReady] = useState(false);
  useEffect(() => { try { const stored = sessionStorage.getItem("cims-user"); if (stored) setUser(JSON.parse(stored)); } finally { setReady(true); } }, []);
  const setCurrentUser = (user: CurrentUser | null) => { if (user) { sessionStorage.setItem("cims-user", JSON.stringify(user)); setUser(user); } else { sessionStorage.removeItem("cims-user"); sessionStorage.removeItem("cims-demo-session"); } };
  return <ClinicContext.Provider value={{ currentUser, ready, setCurrentUser }}>{children}</ClinicContext.Provider>;
};

export const useRole = () => useContext(ClinicContext);
