"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { UserRole, CurrentUser } from "@/types";

export const PRESET_STAFF_MEMBERS: Record<UserRole, CurrentUser> = {
  ADMIN: {
    id: "usr_admin",
    name: "Dr. Arthur Vance",
    email: "admin@cims.hospital",
    role: "ADMIN",
    department: "Chief Medical Officer / Admin",
    avatar: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=150&auto=format&fit=crop&q=80",
    licenseNumber: "MED-ADM-9901",
  },
  DOCTOR: {
    id: "usr_doc_1",
    name: "Dr. Sarah Jenkins, MD",
    email: "dr.sarah@cims.hospital",
    role: "DOCTOR",
    department: "Internal Medicine",
    avatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80",
    licenseNumber: "MED-DOC-4482",
  },
  NURSE: {
    id: "usr_nurse_1",
    name: "Clara Oswald, RN",
    email: "nurse.clara@cims.hospital",
    role: "NURSE",
    department: "OPD Triage Station",
    avatar: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=150&auto=format&fit=crop&q=80",
    licenseNumber: "NUR-REG-8821",
  },
  RECEPTIONIST: {
    id: "usr_rec_1",
    name: "Emma Watson",
    email: "reception@cims.hospital",
    role: "RECEPTIONIST",
    department: "Registration & Front Desk",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
  },
  PHARMACIST: {
    id: "usr_pharm_1",
    name: "David Kim, PharmD",
    email: "pharmacy@cims.hospital",
    role: "PHARMACIST",
    department: "Central Pharmacy",
    avatar: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&auto=format&fit=crop&q=80",
    licenseNumber: "PHM-LIC-3341",
  },
  LAB_TECH: {
    id: "usr_lab_1",
    name: "Dr. Robert Langdon",
    email: "lab@cims.hospital",
    role: "LAB_TECH",
    department: "Diagnostic Pathology & Biochemistry",
    avatar: "https://images.unsplash.com/photo-1562774053-701939374585?w=150&auto=format&fit=crop&q=80",
    licenseNumber: "LAB-SCI-5590",
  },
  BILLING_OFFICER: {
    id: "usr_bill_1",
    name: "Sophia Martinez",
    email: "billing@cims.hospital",
    role: "BILLING_OFFICER",
    department: "Patient Accounts & Cashier",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
  },
};

interface RoleContextType {
  currentUser: CurrentUser;
  switchRole: (role: UserRole) => void;
}

const RoleContext = createContext<RoleContextType>({
  currentUser: PRESET_STAFF_MEMBERS.DOCTOR,
  switchRole: () => {},
});

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRole, setCurrentRole] = useState<UserRole>("DOCTOR");

  useEffect(() => {
    const saved = localStorage.getItem("cims_active_role") as UserRole;
    if (saved && PRESET_STAFF_MEMBERS[saved]) {
      setCurrentRole(saved);
    }
  }, []);

  const switchRole = (role: UserRole) => {
    setCurrentRole(role);
    localStorage.setItem("cims_active_role", role);
  };

  const currentUser = PRESET_STAFF_MEMBERS[currentRole];

  return (
    <RoleContext.Provider value={{ currentUser, switchRole }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => useContext(RoleContext);
