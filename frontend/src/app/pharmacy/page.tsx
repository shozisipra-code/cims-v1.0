"use client";

import { FormEvent, useEffect, useId, useMemo, useState } from "react";
import { BarChart3, ClipboardList, PackagePlus, Pill, Plus, Printer, Search, ShoppingCart, Stethoscope, Trash2, UserRound, Warehouse } from "lucide-react";
import { useRole } from "@/components/layout/RoleContext";
import { CimsSelect } from "@/components/ui/CimsSelect";
import { PAYMENT_METHODS, pakistanDateKey } from "@/lib/pakistan";
import { calculateAge, formatCurrency, formatDateTime } from "@/lib/utils";
import { downloadPdfDocument } from "@/lib/pdf";

type TabName = "prescriptions" | "sale" | "stock" | "statement";
type StockUnit = "SYRUP_BOTTLE" | "PILL_PACK" | "PIECE" | "BOTTLE";
type SaleLine = { medicationId: string; quantity: number; unit: StockUnit };

const STOCK_UNIT_OPTIONS: Array<{ value: StockUnit; label: string }> = [
  { value: "SYRUP_BOTTLE", label: "Syrup bottles" },
  { value: "PILL_PACK", label: "Pill packs" },
  { value: "PIECE", label: "Pieces" },
  { value: "BOTTLE", label: "Bottles" },
];
const emptyStock = () => ({ medicationId: "", brandName: "", genericName: "", form: "", strength: "", quantity: "", stockUnit: "PIECE" as StockUnit, minStockLevel: "10", unitPrice: "", batchNumber: "", expiryDate: "", manufacturer: "", reference: "" });
const emptySaleLine = (): SaleLine => ({ medicationId: "", quantity: 1, unit: "PIECE" });
const unitLabel = (unit: string, quantity?: number) => {
  const label = STOCK_UNIT_OPTIONS.find(option => option.value === unit)?.label || unit.replaceAll("_", " ").toLowerCase();
  return quantity === 1 ? label.replace(/s$/, "") : label;
};

export default function PharmacyPage() {
  const { currentUser, ready } = useRole();
  const [tab, setTab] = useState<TabName>("prescriptions");
  const [data, setData] = useState<any>({ medications: [], prescriptions: [], sales: [], movements: [], dailySales: [], dailyMovements: [] });
  const [query, setQuery] = useState("");
  const [stockQuery, setStockQuery] = useState("");
  const [statementDate, setStatementDate] = useState(pakistanDateKey());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sale, setSale] = useState({ customerName: "", paymentMethod: "Cash", notes: "" });
  const [saleLines, setSaleLines] = useState<SaleLine[]>([emptySaleLine()]);
  const [stock, setStock] = useState(emptyStock);

  function loadPharmacy(date = statementDate) {
    setLoading(true); setError("");
    if (!ready) return;
    fetch(`/api/pharmacy?date=${encodeURIComponent(date)}`, { headers: { "x-cims-user-id": currentUser.id } }).then(async response => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to load pharmacy data.");
      setData(result);
    }).catch(cause => setError(cause.message || "Unable to load pharmacy data.")).finally(() => setLoading(false));
  }

  useEffect(() => { loadPharmacy(); }, [currentUser.id, ready]);

  const filteredPrescriptions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return data.prescriptions;
    return data.prescriptions.filter((rx: any) => `${rx.patient.firstName} ${rx.patient.lastName} ${rx.patient.mrn} ${rx.doctor.name} ${rx.items.map((item: any) => item.medicationName).join(" ")}`.toLowerCase().includes(term));
  }, [data.prescriptions, query]);
  const filteredStock = useMemo(() => {
    const term = stockQuery.trim().toLowerCase();
    if (!term) return data.medications;
    return data.medications.filter((medicine: any) => `${medicine.brandName} ${medicine.genericName} ${medicine.strength} ${medicine.form} ${medicine.manufacturer || ""} ${medicine.batchNumber || ""} ${unitLabel(medicine.stockUnit || "PIECE")}`.toLowerCase().includes(term));
  }, [data.medications, stockQuery]);
  const saleTotal = saleLines.reduce((sum, line) => sum + (data.medications.find((item: any) => item.id === line.medicationId)?.unitPrice || 0) * Number(line.quantity || 0), 0);
  const dailyRevenue = data.dailySales.reduce((sum: number, item: any) => sum + Number(item.totalAmount), 0);
  const dailyUnits = data.dailySales.reduce((sum: number, saleItem: any) => sum + saleItem.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0), 0);
  const dailyStockIn = data.dailyMovements.filter((item: any) => item.quantity > 0).reduce((sum: number, item: any) => sum + item.quantity, 0);

  async function submitSale(event: FormEvent) {
    event.preventDefault();
    const items = saleLines.filter(line => line.medicationId && line.quantity > 0);
    if (!items.length) return setError("Add at least one medicine to the sale.");
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/pharmacy", { method: "POST", headers: { "Content-Type": "application/json", "x-cims-user-id": currentUser.id }, body: JSON.stringify({ action: "SALE", ...sale, items }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Sale could not be completed.");
      setMessage(`${result.sale.saleNumber} completed for ${formatCurrency(result.sale.totalAmount)}.`);
      setSale({ customerName: "", paymentMethod: "Cash", notes: "" }); setSaleLines([emptySaleLine()]); loadPharmacy();
    } catch (cause: any) { setError(cause.message); } finally { setSaving(false); }
  }

  async function submitStock(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/pharmacy", { method: "POST", headers: { "Content-Type": "application/json", "x-cims-user-id": currentUser.id }, body: JSON.stringify({ action: "STOCK", ...stock }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Stock could not be updated.");
      setMessage(result.created ? `${result.medication.brandName} added to stock and is now available for sale.` : `${result.medication.brandName} stock updated to ${result.medication.stockQuantity} ${unitLabel(result.medication.stockUnit, result.medication.stockQuantity)}.`);
      setStock(emptyStock()); loadPharmacy();
    } catch (cause: any) { setError(cause.message); } finally { setSaving(false); }
  }

  function adjustMedicine(medicine: any) {
    setStock({ medicationId: medicine.id, brandName: medicine.brandName, genericName: medicine.genericName, form: medicine.form, strength: medicine.strength, quantity: "", stockUnit: medicine.stockUnit || "PIECE", minStockLevel: String(medicine.minStockLevel), unitPrice: String(medicine.unitPrice), batchNumber: medicine.batchNumber || "", expiryDate: medicine.expiryDate?.slice(0, 10) || "", manufacturer: medicine.manufacturer || "", reference: "" });
    window.requestAnimationFrame(() => document.getElementById("pharmacy-stock-entry")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function downloadPharmacyPdf(section = tab) {
    if (section === "prescriptions") return downloadPdfDocument({ filename: `pharmacy-prescriptions-${pakistanDateKey()}.pdf`, title: "Pharmacy Prescriptions", orientation: "landscape", sections: [{ title: "Prescriptions", columns: ["Date", "Patient", "MRN", "Doctor", "Status", "Medicine", "Dose", "Frequency", "Duration", "Quantity"], rows: data.prescriptions.flatMap((rx: any) => rx.items.map((item: any) => [formatDateTime(rx.createdAt), `${rx.patient.firstName} ${rx.patient.lastName}`, rx.patient.mrn, rx.doctor.name, rx.status, item.medicationName, item.dosage, item.frequency, item.duration, item.quantity])) }] });
    if (section === "sale") return downloadPdfDocument({ filename: `pharmacy-sales-${pakistanDateKey()}.pdf`, title: "Pharmacy Sales", orientation: "landscape", metrics: [{ label: "Sales", value: data.sales.length }, { label: "Total", value: formatCurrency(data.sales.reduce((sum: number, item: any) => sum + Number(item.totalAmount), 0)) }], sections: [{ title: "Recent sales", columns: ["Sale", "Date", "Customer", "Items", "Payment", "Sold by", "Total"], rows: data.sales.map((item: any) => [item.saleNumber, formatDateTime(item.createdAt), item.customerName || "Walk-in", item.items.map((line: any) => `${line.medicationName}: ${line.quantity} ${unitLabel(line.unit || "PIECE", line.quantity)}`).join("; "), item.paymentMethod, item.soldBy, formatCurrency(item.totalAmount)]) }] });
    if (section === "stock") return downloadPdfDocument({ filename: `pharmacy-stock-${pakistanDateKey()}.pdf`, title: "Pharmacy Stock", orientation: "landscape", metrics: [{ label: "Inventory lines", value: filteredStock.length }, { label: "Low stock", value: filteredStock.filter((item: any) => item.stockQuantity <= item.minStockLevel).length }], sections: [{ title: "Current stock", columns: ["Medicine", "Generic", "Form", "Strength", "Stock", "Minimum", "Price / unit", "Batch", "Expiry", "Manufacturer"], rows: filteredStock.map((item: any) => [item.brandName, item.genericName, item.form, item.strength, `${item.stockQuantity} ${unitLabel(item.stockUnit || "PIECE", item.stockQuantity)}`, item.minStockLevel, formatCurrency(item.unitPrice), item.batchNumber, item.expiryDate ? new Date(item.expiryDate).toLocaleDateString("en-PK") : "-", item.manufacturer]) }] });
    return downloadPdfDocument({ filename: `pharmacy-statement-${statementDate}.pdf`, title: "Pharmacy Daily Statement", subtitle: statementDate, orientation: "landscape", metrics: [{ label: "Gross sales", value: formatCurrency(dailyRevenue) }, { label: "Transactions", value: data.dailySales.length }, { label: "Units sold", value: dailyUnits }, { label: "Stock received", value: dailyStockIn }], sections: [{ title: "Sales", columns: ["Sale", "Time", "Customer", "Payment", "Items", "Total"], rows: data.dailySales.map((item: any) => [item.saleNumber, formatDateTime(item.createdAt), item.customerName || "Walk-in", item.paymentMethod, item.items.map((line: any) => `${line.medicationName}: ${line.quantity} ${unitLabel(line.unit || "PIECE", line.quantity)}`).join("; "), formatCurrency(item.totalAmount)]) }, { title: "Stock movements", columns: ["Time", "Medicine", "Type", "Change", "Balance", "Reference", "Recorded by"], rows: data.dailyMovements.map((item: any) => [formatDateTime(item.createdAt), `${item.medication.brandName} ${item.medication.strength}`, item.type.replaceAll("_", " "), `${item.quantity} ${unitLabel(item.unit || item.medication.stockUnit || "PIECE", Math.abs(item.quantity))}`, item.balanceAfter, item.reference, item.recordedBy]) }] });
  }

  return <div className="pharmacy-page space-y-5">
    <header className="page-header"><div><h1 className="page-title flex items-center gap-2"><Pill size={24} /> Pharmacy</h1><p className="page-subtitle">Prescriptions, medicine sales, inventory, and daily activity.</p></div><button type="button" className="btn no-print" disabled={loading} onClick={() => void downloadPharmacyPdf()}><Printer size={15} />Download current PDF</button></header>
    <nav className="pharmacy-tabs" aria-label="Pharmacy sections">
      <Tab active={tab === "prescriptions"} onClick={() => setTab("prescriptions")} icon={<ClipboardList />} label="Prescriptions" />
      <Tab active={tab === "sale"} onClick={() => setTab("sale")} icon={<ShoppingCart />} label="Medicine Sale" />
      <Tab active={tab === "stock"} onClick={() => setTab("stock")} icon={<Warehouse />} label="Stock" />
      <Tab active={tab === "statement"} onClick={() => setTab("statement")} icon={<BarChart3 />} label="Daily Statement" />
    </nav>
    {message && <div className="pharmacy-alert success">{message}</div>}{error && <div className="pharmacy-alert error" role="alert">{error}</div>}
    {loading && <section className="card card-body pharmacy-message">Loading pharmacy data…</section>}

    {!loading && tab === "prescriptions" && <><section className="card pharmacy-search"><Search size={18} /><input className="input" aria-label="Search prescriptions" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search patient, MRN, doctor, or medicine" /></section>{!filteredPrescriptions.length ? <Empty text="No prescriptions found." /> : <div className="pharmacy-prescriptions">{filteredPrescriptions.map((rx: any) => <Prescription key={rx.id} rx={rx} />)}</div>}</>}

    {!loading && tab === "sale" && <div className="pharmacy-two-column">
      <form className="card pharmacy-form-card" onSubmit={submitSale}><CardTitle icon={<ShoppingCart />} text="New medicine sale" /><div className="pharmacy-form-body">
        <div className="pharmacy-form-grid"><label>Customer / patient<input className="input" value={sale.customerName} onChange={event => setSale({ ...sale, customerName: event.target.value })} placeholder="Optional" /></label><label>Payment method<CimsSelect value={sale.paymentMethod} onChange={paymentMethod => setSale({ ...sale, paymentMethod })} options={PAYMENT_METHODS.map(value => ({ value, label: value }))} /></label></div>
        <div className="sale-lines"><div className="sale-lines-heading"><strong>Medicines</strong><button type="button" className="btn" onClick={() => setSaleLines(lines => [...lines, emptySaleLine()])}><Plus size={15} /> Add line</button></div>{saleLines.map((line, index) => { const medicine = data.medications.find((item: any) => item.id === line.medicationId); return <div className="sale-line" key={index}><MedicineSearch medications={data.medications} value={line.medicationId} unit={line.unit} onChange={medicationId => { const selected = data.medications.find((item: any) => item.id === medicationId); setSaleLines(lines => lines.map((item, i) => i === index ? { ...item, medicationId, unit: selected?.stockUnit || item.unit } : item)); }} /><CimsSelect ariaLabel={`Package unit ${index + 1}`} value={line.unit} onChange={unit => setSaleLines(lines => lines.map((item, i) => i === index ? { ...item, unit: unit as StockUnit, medicationId: medicine?.stockUnit === unit ? item.medicationId : "" } : item))} options={STOCK_UNIT_OPTIONS} /><input className="input" type="number" min={1} max={medicine?.stockQuantity || undefined} value={line.quantity} onChange={event => setSaleLines(lines => lines.map((item, i) => i === index ? { ...item, quantity: Number(event.target.value) } : item))} aria-label={`Count ${index + 1}`} /><span>{medicine ? formatCurrency(medicine.unitPrice * line.quantity) : "—"}</span><button type="button" className="icon-button" aria-label={`Remove sale line ${index + 1}`} disabled={saleLines.length === 1} onClick={() => setSaleLines(lines => lines.filter((_, i) => i !== index))}><Trash2 size={16} /></button></div>; })}</div>
        <label>Notes<textarea className="input" value={sale.notes} onChange={event => setSale({ ...sale, notes: event.target.value })} /></label><div className="sale-total"><span>Total</span><strong>{formatCurrency(saleTotal)}</strong></div><button className="btn btn-primary pharmacy-submit" disabled={saving || saleTotal <= 0}>{saving ? "Completing…" : "Complete sale"}</button>
      </div></form><SalesTable sales={data.sales} title="Recent sales" />
    </div>}

    {!loading && tab === "stock" && <>
      <section className="card pharmacy-search"><Search size={18} /><input className="input" aria-label="Search medicine stock" value={stockQuery} onChange={event => setStockQuery(event.target.value)} placeholder="Search any medicine, generic name, strength, batch, manufacturer, or unit" />{stockQuery && <button type="button" className="btn" onClick={() => setStockQuery("")}>Clear</button>}</section>
      <Stats items={[{ label: "Medicines", value: filteredStock.length, sub: stockQuery ? `of ${data.medications.length} inventory lines` : "Inventory lines" }, { label: "Low stock", value: filteredStock.filter((item: any) => item.stockQuantity <= item.minStockLevel).length, sub: "At or below minimum" }, { label: "Stock count", value: filteredStock.reduce((sum: number, item: any) => sum + item.stockQuantity, 0), sub: "Across all package units" }]} />
      <div className="pharmacy-two-column stock-layout"><StockTable medications={filteredStock} onAdjust={adjustMedicine} /><form id="pharmacy-stock-entry" className="card pharmacy-form-card" onSubmit={submitStock}><CardTitle icon={<PackagePlus />} text={stock.medicationId ? "Adjust medicine stock" : "Add medicine stock"} /><div className="pharmacy-form-body">
        {stock.medicationId && <div className="stock-editing"><span>Editing an existing stock line</span><button type="button" className="btn" onClick={() => setStock(emptyStock())}>Add new instead</button></div>}
        <div className="pharmacy-form-grid"><label>Medicine name *<input required className="input" value={stock.brandName} onChange={event => setStock({ ...stock, brandName: event.target.value })} placeholder="e.g. Panadol" /></label><label>Generic name<input className="input" value={stock.genericName} onChange={event => setStock({ ...stock, genericName: event.target.value })} placeholder="e.g. Paracetamol" /></label><label>Form *<input required className="input" value={stock.form} onChange={event => setStock({ ...stock, form: event.target.value })} placeholder="Tablet, syrup, capsule…" /></label><label>Strength *<input required className="input" value={stock.strength} onChange={event => setStock({ ...stock, strength: event.target.value })} placeholder="500 mg or 120 mg/5 ml" /></label></div>
        <div className="stock-quantity-row"><label>Count change *<input required className="input" type="number" value={stock.quantity} onChange={event => setStock({ ...stock, quantity: event.target.value })} placeholder={stock.medicationId ? "Positive adds, negative removes" : "Opening count"} /></label><label>Package unit *<CimsSelect ariaLabel="Stock package unit" value={stock.stockUnit} onChange={unit => setStock({ ...stock, stockUnit: unit as StockUnit })} options={STOCK_UNIT_OPTIONS} /></label></div>
        <div className="pharmacy-form-grid"><label>Price per unit (PKR) *<input required className="input" type="number" min="0" step="0.01" value={stock.unitPrice} onChange={event => setStock({ ...stock, unitPrice: event.target.value })} /></label><label>Minimum stock<input className="input" type="number" min="0" value={stock.minStockLevel} onChange={event => setStock({ ...stock, minStockLevel: event.target.value })} /></label><label>Batch number<input className="input" value={stock.batchNumber} onChange={event => setStock({ ...stock, batchNumber: event.target.value })} /></label><label>Expiry date<input className="input" type="date" value={stock.expiryDate} onChange={event => setStock({ ...stock, expiryDate: event.target.value })} /></label><label>Manufacturer<input className="input" value={stock.manufacturer} onChange={event => setStock({ ...stock, manufacturer: event.target.value })} /></label><label>Reference<input className="input" value={stock.reference} onChange={event => setStock({ ...stock, reference: event.target.value })} placeholder="Supplier invoice or note" /></label></div>
        <button className="btn btn-primary" disabled={saving || !stock.brandName || !stock.form || !stock.strength || !stock.quantity || stock.unitPrice === ""}>{saving ? "Saving…" : stock.medicationId ? "Update stock" : "Add to stock"}</button>
      </div></form></div><MovementTable movements={data.movements} title="Recent stock movements" />
    </>}

    {!loading && tab === "statement" && <><section className="card statement-filter"><label>Statement date<input className="input" type="date" value={statementDate} onChange={event => setStatementDate(event.target.value)} /></label><button className="btn btn-primary" onClick={() => loadPharmacy(statementDate)}>Load statement</button><button className="btn" onClick={() => void downloadPharmacyPdf("statement")}><Printer size={15} />Download PDF</button></section><Stats items={[{ label: "Gross sales", value: formatCurrency(dailyRevenue), sub: `${data.dailySales.length} transactions` }, { label: "Units sold", value: dailyUnits, sub: "Across all medicines" }, { label: "Stock received", value: dailyStockIn, sub: "Units added" }]} /><div className="pharmacy-two-column"><SalesTable sales={data.dailySales} title={`Sales — ${statementDate}`} /><MovementTable movements={data.dailyMovements} title={`Stock activity — ${statementDate}`} /></div></>}
  </div>;
}

function Tab({ active, onClick, icon, label }: any) { return <button type="button" className={active ? "active" : ""} onClick={onClick}>{icon}<span>{label}</span></button>; }
function CardTitle({ icon, text }: any) { return <div className="card-header"><h2>{icon}{text}</h2></div>; }
function Empty({ text }: { text: string }) { return <section className="card card-body pharmacy-message"><ClipboardList size={28} /><strong>{text}</strong></section>; }
function Stats({ items }: { items: any[] }) { return <div className="pharmacy-stock-summary">{items.map(item => <div className="stat-card" key={item.label}><div className="stat-label">{item.label}</div><div className="stat-value">{item.value}</div><div className="stat-sub">{item.sub}</div></div>)}</div>; }
function MedicineSearch({ medications, value, unit, onChange }: { medications: any[]; value: string; unit: StockUnit; onChange: (id: string) => void }) {
  const listId = useId();
  const selected = medications.find(item => item.id === value);
  const [search, setSearch] = useState(selected ? `${selected.brandName} ${selected.strength}` : "");
  const [open, setOpen] = useState(false);
  useEffect(() => { if (selected) setSearch(`${selected.brandName} ${selected.strength}`); }, [selected?.id]);
  useEffect(() => { if (!selected) setSearch(""); }, [unit]);
  const term = search.trim().toLowerCase();
  const matches = medications.filter(item => !term || `${item.brandName} ${item.genericName} ${item.strength} ${item.form} ${unitLabel(item.stockUnit || "PIECE")}`.toLowerCase().includes(term)).slice(0, 8);
  return <div className="medicine-picker"><Search size={15} /><input className="input" value={search} role="combobox" aria-label="Search medicine for sale" aria-expanded={open} aria-controls={listId} placeholder="Search medicine" onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)} onChange={event => { setSearch(event.target.value); setOpen(true); if (value) onChange(""); }} />{open && <div id={listId} className="medicine-picker-results" role="listbox">{matches.map(item => <button type="button" role="option" aria-selected={item.id === value} key={item.id} onMouseDown={event => event.preventDefault()} onClick={() => { onChange(item.id); setSearch(`${item.brandName} ${item.strength}`); setOpen(false); }}><span><strong>{item.brandName} {item.strength}</strong><small>{item.genericName} · {item.form}</small></span><span>{item.stockQuantity} {unitLabel(item.stockUnit || "PIECE", item.stockQuantity)}</span></button>)}{!matches.length && <p>No matching stock medicine.</p>}</div>}</div>;
}
function Prescription({ rx }: { rx: any }) { return <article className="card prescription-card"><div className="prescription-heading"><div className="prescription-patient"><span className="prescription-icon"><UserRound size={19} /></span><div><h2>{rx.patient.firstName} {rx.patient.lastName}</h2><p>{rx.patient.mrn} · {calculateAge(rx.patient.dateOfBirth)} years</p></div></div><span className={`prescription-status ${rx.status.toLowerCase()}`}>{rx.status.replaceAll("_", " ")}</span></div><div className="prescription-meta"><span><Stethoscope size={15} /> Prescribed by <strong>{rx.doctor.name}</strong></span><span>{formatDateTime(rx.createdAt)}</span></div><div className="table-scroll"><table className="prescription-table"><thead><tr><th>Medicine</th><th>Dose & route</th><th>Frequency</th><th>Duration</th><th>Qty</th><th>Instructions</th></tr></thead><tbody>{rx.items.map((item: any) => <tr key={item.id}><td><strong>{item.medicationName}</strong><small>{item.genericName}</small></td><td>{item.dosage}<small>{item.route}</small></td><td>{item.frequency}</td><td>{item.duration}</td><td>{item.quantity}</td><td>{item.instructions || "—"}</td></tr>)}</tbody></table></div></article>; }
function SalesTable({ sales, title }: any) { return <section className="card"><CardTitle icon={<ShoppingCart />} text={title} />{!sales.length ? <div className="card-body pharmacy-message">No sales recorded.</div> : <div className="table-scroll"><table className="pharmacy-table"><thead><tr><th>Sale</th><th>Customer</th><th>Items</th><th>Payment</th><th>Total</th><th>Time</th></tr></thead><tbody>{sales.map((sale: any) => <tr key={sale.id}><td><strong>{sale.saleNumber}</strong><small>{sale.soldBy}</small></td><td>{sale.customerName || "Walk-in"}</td><td>{sale.items.map((item: any) => `${item.quantity} ${unitLabel(item.unit || "PIECE", item.quantity)}`).join(", ")}</td><td>{sale.paymentMethod}</td><td><strong>{formatCurrency(sale.totalAmount)}</strong></td><td>{formatDateTime(sale.createdAt)}</td></tr>)}</tbody></table></div>}</section>; }
function StockTable({ medications, onAdjust }: { medications: any[]; onAdjust: (item: any) => void }) { return <section className="card"><CardTitle icon={<Warehouse />} text="Current stock" />{!medications.length ? <div className="card-body pharmacy-message">No medicines match this search.</div> : <div className="table-scroll"><table className="pharmacy-table"><thead><tr><th>Medicine</th><th>Form</th><th>Stock</th><th>Minimum</th><th>Price / unit</th><th>Expiry</th><th></th></tr></thead><tbody>{medications.map((item: any) => <tr key={item.id} className={item.stockQuantity <= item.minStockLevel ? "low-stock" : ""}><td><strong>{item.brandName} {item.strength}</strong><small>{item.genericName}</small></td><td>{item.form}</td><td><strong>{item.stockQuantity} {unitLabel(item.stockUnit || "PIECE", item.stockQuantity)}</strong></td><td>{item.minStockLevel}</td><td>{formatCurrency(item.unitPrice)}<small>per {unitLabel(item.stockUnit || "PIECE", 1)}</small></td><td>{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString("en-PK") : "—"}</td><td><button type="button" className="btn stock-adjust-button" onClick={() => onAdjust(item)}>Adjust</button></td></tr>)}</tbody></table></div>}</section>; }
function MovementTable({ movements, title }: any) { return <section className="card"><CardTitle icon={<Warehouse />} text={title} />{!movements.length ? <div className="card-body pharmacy-message">No stock activity recorded.</div> : <div className="table-scroll"><table className="pharmacy-table"><thead><tr><th>Medicine</th><th>Type</th><th>Change</th><th>Balance</th><th>Reference</th><th>Time</th></tr></thead><tbody>{movements.map((item: any) => <tr key={item.id}><td><strong>{item.medication.brandName}</strong><small>{item.medication.strength}</small></td><td>{item.type.replaceAll("_", " ")}</td><td className={item.quantity > 0 ? "quantity-positive" : "quantity-negative"}>{item.quantity > 0 ? "+" : ""}{item.quantity} {unitLabel(item.unit || item.medication.stockUnit || "PIECE", Math.abs(item.quantity))}</td><td>{item.balanceAfter}</td><td>{item.reference || "—"}</td><td>{formatDateTime(item.createdAt)}</td></tr>)}</tbody></table></div>}</section>; }
