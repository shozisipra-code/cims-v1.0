"use client";

import React, { CSSProperties, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";

export type CimsSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type CimsSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: CimsSelectOption[];
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  onEnterCommit?: () => void;
};

export function CimsSelect({
  value,
  onChange,
  options,
  className = "input",
  placeholder = "Select an option",
  ariaLabel,
  disabled = false,
  onEnterCommit,
}: CimsSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selectedIndex = options.findIndex(option => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const positionMenu = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const estimatedHeight = Math.min(options.length * 38 + 10, 240);
    const roomBelow = window.innerHeight - rect.bottom;
    const opensUp = roomBelow < estimatedHeight + 12 && rect.top > roomBelow;
    setMenuStyle({
      left: rect.left,
      top: opensUp ? Math.max(8, rect.top - estimatedHeight - 6) : rect.bottom + 6,
      width: rect.width,
      maxHeight: estimatedHeight,
    });
  };

  const openMenu = () => {
    if (disabled) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : Math.max(0, options.findIndex(option => !option.disabled)));
    positionMenu();
    setOpen(true);
  };

  const choose = (index: number, advanceAfterChoice = false) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
    if (advanceAfterChoice) window.requestAnimationFrame(() => onEnterCommit?.());
  };

  const moveActive = (direction: 1 | -1) => {
    if (!options.length) return;
    let next = activeIndex;
    for (let attempts = 0; attempts < options.length; attempts += 1) {
      next = (next + direction + options.length) % options.length;
      if (!options[next].disabled) break;
    }
    setActiveIndex(next);
  };

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const reposition = () => positionMenu();
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, options.length]);

  return <div className="cims-select">
    <button
      ref={triggerRef}
      type="button"
      className={`${className} cims-select-trigger ${open ? "is-open" : ""}`}
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
      disabled={disabled}
      onClick={() => open ? setOpen(false) : openMenu()}
      onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (!open) openMenu();
          else moveActive(event.key === "ArrowDown" ? 1 : -1);
        } else if (event.key === "Home" && open) {
          event.preventDefault();
          setActiveIndex(Math.max(0, options.findIndex(option => !option.disabled)));
        } else if (event.key === "End" && open) {
          event.preventDefault();
          const lastEnabled = options.map(option => !option.disabled).lastIndexOf(true);
          setActiveIndex(Math.max(0, lastEnabled));
        } else if ((event.key === "Enter" || event.key === " ") && open) {
          event.preventDefault();
          choose(activeIndex, true);
        } else if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
        } else if (event.key === "Tab") {
          setOpen(false);
        }
      }}
    >
      <span className={selected ? "cims-select-value" : "cims-select-placeholder"}>{selected?.label || placeholder}</span>
      <ChevronDown className="cims-select-chevron" aria-hidden="true" />
    </button>

    {open && menuStyle && createPortal(
      <div
        ref={menuRef}
        id={listboxId}
        role="listbox"
        aria-label={ariaLabel}
        className="cims-select-menu"
        style={menuStyle}
      >
        {options.map((option, index) => <button
          key={option.value}
          id={`${listboxId}-option-${index}`}
          type="button"
          role="option"
          aria-selected={option.value === value}
          disabled={option.disabled}
          className={`cims-select-option ${index === activeIndex ? "is-active" : ""} ${option.value === value ? "is-selected" : ""}`}
          onMouseEnter={() => !option.disabled && setActiveIndex(index)}
          onClick={() => choose(index)}
        >
          <span>{option.label}</span>
          {option.value === value && <Check aria-hidden="true" />}
        </button>)}
      </div>,
      document.body,
    )}
  </div>;
}
