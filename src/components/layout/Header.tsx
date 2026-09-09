"use client";

import React, { useState } from "react";
import { useRole, PRESET_STAFF_MEMBERS } from "./RoleContext";
import { UserRole } from "@/types";
import {
  Bell,
  Search,
  ChevronDown,
  ShieldAlert,
  Activity,
  UserCheck,
  Building2,
  Stethoscope,
} from "lucide-react";

export const Header: React.FC = () => {
  const { currentUser, switchRole } = useRole();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <header className="no-print h-16 border-b border-slate-200 bg-white/95 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      {/* Left: Facility Indicator & Quick Search */}
      <div className="flex items-center gap-6 flex-1 max-w-xl">
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-teal-50 border border-teal-200 rounded-full text-xs font-semibold text-teal-800">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
          <Building2 className="w-3.5 h-3.5" />
          <span>CIMS Central Hospital • OPD Block A</span>
        </div>

        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search patient by MRN, Name, Phone, or National ID (e.g., CIMS-2026-0001)..."
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Right: Role Switcher & Profile */}
      <div className="flex items-center gap-4">
        {/* Quick Demo Role Switcher Badge */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 transition-all text-left group"
            title="Click to simulate switching staff roles"
          >
            <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-semibold text-xs overflow-hidden shadow-sm">
              {currentUser.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                currentUser.name.charAt(0)
              )}
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800">{currentUser.name}</span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-teal-100 text-teal-800 rounded">
                  {currentUser.role}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">{currentUser.department}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors" />
          </button>

          {/* Role selection dropdown */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-3 py-1.5 border-b border-slate-100">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Switch Active Staff Role
                </p>
                <p className="text-xs text-slate-500">Experience CIMS from any staff perspective</p>
              </div>

              <div className="max-h-72 overflow-y-auto py-1">
                {(Object.keys(PRESET_STAFF_MEMBERS) as UserRole[]).map((role) => {
                  const staff = PRESET_STAFF_MEMBERS[role];
                  const isSelected = currentUser.role === role;
                  return (
                    <button
                      key={role}
                      onClick={() => {
                        switchRole(role);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors ${
                        isSelected ? "bg-teal-50/70 border-l-4 border-teal-600" : ""
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={staff.avatar} alt={staff.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-xs font-semibold truncate ${isSelected ? "text-teal-900" : "text-slate-800"}`}>
                            {staff.name}
                          </p>
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 text-slate-600">
                            {role}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{staff.department}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
