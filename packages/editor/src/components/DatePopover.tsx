import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { zhCN } from "react-day-picker/locale";

function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function DatePopover({
  top,
  left,
  initial,
  onConfirm,
  onCancel,
}: {
  top: number;
  left: number;
  initial: Date;
  onConfirm: (iso: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState(initial);
  const [month, setMonth] = useState(initial);
  const boxRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selected);
  const onConfirmRef = useRef(onConfirm);
  const onCancelRef = useRef(onCancel);
  selectedRef.current = selected;
  onConfirmRef.current = onConfirm;
  onCancelRef.current = onCancel;

  useEffect(() => {
    boxRef.current?.focus();
  }, []);

  useEffect(() => {
    setMonth(selected);
  }, [selected]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        event.stopPropagation();
        setSelected((current) => shiftDate(current, -1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        setSelected((current) => shiftDate(current, 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setSelected((current) => shiftDate(current, -7));
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        setSelected((current) => shiftDate(current, 7));
      } else if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        onConfirmRef.current(toIso(selectedRef.current));
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCancelRef.current();
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (!boxRef.current?.contains(event.target as Node)) onCancelRef.current();
    }

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <div
      ref={boxRef}
      tabIndex={-1}
      role="dialog"
      aria-label="选择日期"
      className="date-popover absolute z-30 rounded-lg border border-border bg-bg p-1.5 shadow-md outline-none"
      style={{ top, left, transform: "translateY(calc(-100% - 6px))" }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <DayPicker
        mode="single"
        required
        locale={zhCN}
        month={month}
        onMonthChange={setMonth}
        selected={selected}
        onSelect={(date) => {
          if (date) setSelected(date);
        }}
        autoFocus={false}
        animate={false}
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted">Enter 写入</p>
        <button
          type="button"
          tabIndex={-1}
          className="rounded-full bg-fg px-2 py-0.5 text-[10px] text-bg hover:opacity-80"
          onClick={() => onConfirm(toIso(selected))}
        >
          写入
        </button>
      </div>
    </div>
  );
}
