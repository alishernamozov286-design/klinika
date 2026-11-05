import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Eye,
  FileText,
  FlaskConical,
  GitMerge,
  History,
  IdCard,
  MapPin,
  Pencil,
  PhoneCall,
  Receipt,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  PAYMENT_METHOD_LABELS,
  type AuditEntry,
  type OrderWithDetails,
  type PatientCard as PatientCardData,
  type PaymentMethod,
} from "@shared/schema";
import { patientAge } from "@shared/patient-identity";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Avatar,
  EmptyState,
  Money,
  PatientNumber,
  PaymentBadge,
  PhoneText,
  SectionCard,
  StatCard,
  StatusBadge,
  TableSkeleton,
  TelegramBadge,
} from "@/components/ui-kit";
import { PatientDialog } from "@/components/patient-dialog";
import { OrderDialog } from "@/components/order-dialog";
import { OrderDetailDialog } from "@/components/order-detail-dialog";
import { ResultsDialog } from "@/components/results-dialog";
import { PrintDialog } from "@/components/print-dialog";
import { MergePatientDialog } from "@/components/merge-patient-dialog";
import { useAuth } from "@/hooks/use-auth";
import { ageGender, formatDate, formatDateTime, formatLongDate, formatPhone, money, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Code-split like on the old history dialog: the trend chart pulls in Recharts. */
const ResultTrend = lazy(() => import("@/components/result-trend").then((m) => ({ default: m.ResultTrend })));

/**
 * Bemor kartasi (TZ §4.1.3 "shaxsiy karta", §4.2 "tashriflar tarixi").
 *
 * One page for everything about one person: who they are, every visit and
 * what was done at it, results over time, the money, and — for the auditor —
 * who has opened this card. Opening it is itself logged (TZ §12).
 */
export default function PatientCardPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [detail, setDetail] = useState<OrderWithDetails | null>(null);
  const [results, setResults] = useState<OrderWithDetails | null>(null);
  const [printing, setPrinting] = useState<OrderWithDetails | null>(null);

  const { data: card, isLoading, error } = useQuery<PatientCardData>({
    queryKey: [`/api/patients/${id}/card`],
    staleTime: 0,
    refetchOnMount: "always",
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="card-premium h-40 skeleton-shimmer" />
        <div className="card-premium">
          <TableSkeleton rows={4} />
        </div>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="card-premium">
        <EmptyState
          icon={UserRound}
          title="Bemor topilmadi"
          description="Karta o'chirilgan yoki boshqa karta bilan birlashtirilgan bo'lishi mumkin."
          action={
            <Button asChild variant="outline">
              <Link href="/patients">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Bemorlar ro'yxati
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const p = card.patient;
  const age = patientAge(p);
  const emergency = p.contacts.find((c) => c.isEmergency);
  const seesMoney = card.totals.billed !== null;
  const allOrders = card.visits.flatMap((v) => v.orders);

  return (
    <div className="space-y-6">
      <Link
        href="/patients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Bemorlar
      </Link>

      {/* ------------------------------------------------------------ header */}
      <section className="card-premium hero-band overflow-hidden p-6">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar name={p.fullName} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <PatientNumber value={p.patientNumber} />
                <TelegramBadge chatId={p.telegramChatId} />
              </div>
              <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-tight" data-testid="text-patient-name">
                {p.fullName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="h-3.5 w-3.5" />
                  {ageGender(age, p.gender)}
                  {p.birthDate && <span className="tabular">· {formatDate(p.birthDate)}</span>}
                </span>
                <PhoneText value={p.phone} className="text-sm" />
                {p.address && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {p.address}
                  </span>
                )}
              </div>
              {(p.passport || p.pinfl) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.passport && (
                    <Badge variant="secondary" className="gap-1.5 font-mono text-[11px] font-medium">
                      <IdCard className="h-3 w-3" />
                      {p.passport}
                    </Badge>
                  )}
                  {p.pinfl && (
                    <Badge variant="secondary" className="gap-1.5 font-mono text-[11px] font-medium">
                      JShShIR {p.pinfl}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {can("orders.create") && (
              <Button onClick={() => setOrderOpen(true)} className="shadow-brand" data-testid="button-card-new-order">
                <FlaskConical className="mr-2 h-4 w-4" />
                Tahlil buyurtma
              </Button>
            )}
            {can("patients.update") && (
              <Button variant="secondary" onClick={() => setEditOpen(true)} data-testid="button-card-edit">
                <Pencil className="mr-2 h-4 w-4" />
                Tahrirlash
              </Button>
            )}
            {can("patients.delete") && (
              <Button variant="outline" size="icon" onClick={() => setMergeOpen(true)} aria-label="Dublikatni birlashtirish">
                <GitMerge className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- stats */}
      <div className={cn("grid gap-4 sm:grid-cols-2", seesMoney ? "xl:grid-cols-4" : "xl:grid-cols-2")}>
        <StatCard
          index={0}
          icon={CalendarDays}
          label="Tashriflar"
          value={card.totals.visits}
          hint={
            card.totals.firstVisitAt
              ? `Birinchi: ${formatDate(card.totals.firstVisitAt)}`
              : `Ro'yxatga olingan: ${formatDate(p.createdAt)}`
          }
        />
        <StatCard
          index={1}
          icon={History}
          tone="emerald"
          label="Oxirgi tashrif"
          value={card.totals.lastVisitAt ? timeAgo(card.totals.lastVisitAt) : "—"}
          hint={`${card.totals.orders} ta buyurtma`}
        />
        {seesMoney && (
          <>
            <StatCard
              index={2}
              icon={Receipt}
              tone="violet"
              label="Jami xizmatlar"
              value={money(card.totals.billed ?? 0, false)}
              suffix="so'm"
              hint={`To'langan: ${money(card.totals.paid ?? 0)}`}
            />
            <StatCard
              index={3}
              icon={Wallet}
              tone={(card.totals.debt ?? 0) > 0 ? "rose" : "emerald"}
              label="Qarzdorlik"
              value={money(card.totals.debt ?? 0, false)}
              suffix="so'm"
              hint={(card.totals.debt ?? 0) > 0 ? "To'lanmagan qoldiq" : "Qarz yo'q"}
            />
          </>
        )}
      </div>

      {/* -------------------------------------------------------------- tabs */}
      <Tabs defaultValue="visits">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="visits" data-testid="tab-card-visits">
            <History className="mr-2 h-4 w-4" />
            Tashriflar
          </TabsTrigger>
          <TabsTrigger value="trend" data-testid="tab-card-trend">
            <TrendingUp className="mr-2 h-4 w-4" />
            Natijalar dinamikasi
          </TabsTrigger>
          {seesMoney && (
            <TabsTrigger value="payments" data-testid="tab-card-payments">
              <Wallet className="mr-2 h-4 w-4" />
              To'lovlar
            </TabsTrigger>
          )}
          <TabsTrigger value="info" data-testid="tab-card-info">
            <FileText className="mr-2 h-4 w-4" />
            Ma'lumotlar
          </TabsTrigger>
          {can("audit.read") && (
            <TabsTrigger value="access" data-testid="tab-card-access">
              <Eye className="mr-2 h-4 w-4" />
              Kirishlar tarixi
            </TabsTrigger>
          )}
        </TabsList>

        {/* ------------------------------------------------------- visits */}
        <TabsContent value="visits" className="mt-6">
          {card.visits.length === 0 ? (
            <div className="card-premium">
              <EmptyState
                icon={History}
                title="Tashriflar yo'q"
                description={
                  can("orders.read")
                    ? "Bu bemor hali biror xizmatdan foydalanmagan."
                    : "Tashriflar tarixini ko'rish uchun buyurtmalarni ko'rish ruxsati kerak."
                }
                action={
                  can("orders.create") ? (
                    <Button onClick={() => setOrderOpen(true)}>
                      <FlaskConical className="mr-2 h-4 w-4" />
                      Birinchi buyurtma
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-border">
              {card.visits.map((visit) => (
                <li key={visit.key} className="relative pl-11" data-testid={`visit-${visit.date}`}>
                  <span className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full border bg-card text-primary shadow-sm">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">
                      {formatLongDate(visit.date)}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">{timeAgo(visit.orders[0].createdAt)}</span>
                    </p>
                    {seesMoney && visit.billed > 0 && (
                      <p className="text-sm text-muted-foreground">
                        <Money value={visit.billed} className="font-semibold text-foreground" />
                        {visit.paid < visit.billed && (
                          <span className="ml-2 text-rose-600 dark:text-rose-400">
                            qarz {money(visit.billed - visit.paid)}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    {visit.orders.map((order) => (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => setDetail(order)}
                        className="card-premium group block w-full p-4 text-left transition-shadow hover:shadow-md"
                        data-testid={`card-order-${order.orderNumber}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="icon-tile h-8 w-8 bg-primary/10 text-primary">
                              <FlaskConical className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                Laboratoriya · <span className="tabular">#{order.orderNumber}</span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(order.createdAt)}
                                {order.referrer && ` · yo'naltirgan: ${order.referrer}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {seesMoney && <PaymentBadge total={order.totalAmount} paid={order.paidAmount} />}
                            <StatusBadge status={order.status} />
                            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {order.items.map((item) => (
                            <Badge
                              key={item.id}
                              variant="outline"
                              className={cn(
                                "font-normal",
                                item.flag === "high" && "border-rose-500/30 bg-rose-500/[0.06]",
                                item.flag === "low" && "border-sky-500/30 bg-sky-500/[0.06]",
                              )}
                            >
                              {item.testName}
                              {item.result ? (
                                <span className="ml-1.5 font-semibold tabular">
                                  {item.result}
                                  {item.unit && <span className="ml-0.5 font-normal text-muted-foreground">{item.unit}</span>}
                                  {item.flag === "high" ? " ↑" : item.flag === "low" ? " ↓" : ""}
                                </span>
                              ) : (
                                <span className="ml-1.5 text-muted-foreground">kutilmoqda</span>
                              )}
                            </Badge>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        {/* -------------------------------------------------------- trend */}
        <TabsContent value="trend" className="mt-6">
          <div className="card-premium overflow-hidden">
            <Suspense fallback={<TableSkeleton rows={3} />}>
              <ResultTrend orders={allOrders} gender={p.gender} />
            </Suspense>
          </div>
        </TabsContent>

        {/* ----------------------------------------------------- payments */}
        {seesMoney && (
          <TabsContent value="payments" className="mt-6">
            <div className="card-premium overflow-hidden">
              {card.payments.length === 0 ? (
                <EmptyState icon={Wallet} title="To'lovlar yo'q" description="Bu bemordan hali to'lov qabul qilinmagan." />
              ) : (
                <div className="overflow-x-auto">
                  <Table className="table-premium">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sana</TableHead>
                        <TableHead>Buyurtma</TableHead>
                        <TableHead>Usul</TableHead>
                        <TableHead className="hidden md:table-cell">Qabul qildi</TableHead>
                        <TableHead className="hidden md:table-cell">Izoh</TableHead>
                        <TableHead className="text-right">Summa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {card.payments.map((pay) => (
                        <TableRow key={pay.id}>
                          <TableCell className="tabular text-muted-foreground">{formatDateTime(pay.createdAt)}</TableCell>
                          <TableCell className="tabular">#{pay.orderNumber}</TableCell>
                          <TableCell>{PAYMENT_METHOD_LABELS[pay.method as PaymentMethod] ?? pay.method}</TableCell>
                          <TableCell className="hidden text-muted-foreground md:table-cell">{pay.createdByName ?? "—"}</TableCell>
                          <TableCell className="hidden text-muted-foreground md:table-cell">{pay.note ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            <Money
                              value={pay.amount}
                              className={cn("font-semibold", pay.amount < 0 && "text-rose-600 dark:text-rose-400")}
                            />
                            {pay.amount < 0 && <span className="block text-[11px] text-rose-600 dark:text-rose-400">qaytarilgan</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* --------------------------------------------------------- info */}
        <TabsContent value="info" className="mt-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard icon={UserRound} title="Shaxsiy ma'lumotlar" bodyClassName="space-y-3">
              <InfoRow label="F.I.Sh" value={p.fullName} />
              <InfoRow label="Tug'ilgan sana" value={p.birthDate ? `${formatDate(p.birthDate)} (${age} yosh)` : age !== null ? `~${age} yosh` : null} />
              <InfoRow label="Jinsi" value={p.gender === "erkak" ? "Erkak" : p.gender === "ayol" ? "Ayol" : null} />
              <InfoRow label="Telefon" value={formatPhone(p.phone)} />
              <InfoRow label="Manzil" value={p.address} />
              <InfoRow label="Pasport / ID" value={p.passport} mono />
              <InfoRow label="JShShIR" value={p.pinfl} mono />
            </SectionCard>
            <div className="space-y-5">
              <SectionCard icon={PhoneCall} title="Favqulodda aloqa">
                {emergency ? (
                  <div className="space-y-3">
                    <InfoRow label="Ismi" value={emergency.name} />
                    <InfoRow label="Kim bo'ladi" value={emergency.relation} />
                    <InfoRow label="Telefon" value={formatPhone(emergency.phone)} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Kiritilmagan</p>
                )}
              </SectionCard>
              <SectionCard icon={ShieldCheck} title="Karta" bodyClassName="space-y-3">
                <InfoRow label="Ro'yxatga olingan" value={formatDateTime(p.createdAt)} />
                <InfoRow label="Oxirgi tahrir" value={p.updatedAt ? formatDateTime(p.updatedAt) : null} />
                <InfoRow
                  label="Telegram"
                  value={p.telegramChatId ? `Ulangan${p.telegramLinkedAt ? ` · ${formatDate(p.telegramLinkedAt)}` : ""}` : "Ulanmagan"}
                />
              </SectionCard>
            </div>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------- access */}
        {can("audit.read") && (
          <TabsContent value="access" className="mt-6">
            <AccessLog patientId={p.id} />
          </TabsContent>
        )}
      </Tabs>

      <PatientDialog open={editOpen} onOpenChange={setEditOpen} patient={p} />
      <OrderDialog open={orderOpen} onOpenChange={setOrderOpen} presetPatient={p} />
      <MergePatientDialog source={mergeOpen ? p : null} onClose={() => setMergeOpen(false)} />
      <OrderDetailDialog
        open={Boolean(detail)}
        onOpenChange={(o) => !o && setDetail(null)}
        order={detail}
        onEnterResults={(o) => {
          setDetail(null);
          setResults(o);
        }}
        onPrint={(o) => {
          setDetail(null);
          setPrinting(o);
        }}
      />
      <ResultsDialog open={Boolean(results)} onOpenChange={(o) => !o && setResults(null)} order={results} />
      <PrintDialog open={Boolean(printing)} onOpenChange={(o) => !o && setPrinting(null)} order={printing} />
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed pb-2.5 last:border-0 last:pb-0">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-right text-sm font-medium", mono && "font-mono", !value && "font-normal text-muted-foreground")}>
        {value || "—"}
      </span>
    </div>
  );
}

const ACCESS_LABELS: Record<string, string> = {
  view: "Kartani ochdi",
  create: "Ro'yxatga oldi",
  update: "O'zgartirdi",
  delete: "O'chirdi",
};

/** TZ §12: who has looked at this patient's medical data, and when. */
function AccessLog({ patientId }: { patientId: string }) {
  const { data, isLoading } = useQuery<{ items: AuditEntry[]; total: number }>({
    queryKey: [`/api/patients/${patientId}/access-log`],
    staleTime: 0,
  });
  const items = data?.items ?? [];
  return (
    <SectionCard
      icon={Eye}
      title="Kirishlar va o'zgarishlar tarixi"
      description="Kim, qachon bu kartani ochgan yoki o'zgartirgan (10 daqiqa ichidagi takroriy ochishlar bitta yozuv)"
      flush
    >
      {isLoading ? (
        <TableSkeleton rows={3} />
      ) : items.length === 0 ? (
        <EmptyState icon={Eye} title="Yozuvlar yo'q" description="Bu kartaga hali hech kim kirmagan." />
      ) : (
        <div className="divide-y">
          {items.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-5 py-3">
              <Avatar name={e.userName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{e.userName}</span>{" "}
                  <span className="text-muted-foreground">{ACCESS_LABELS[e.action] ?? e.action}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">{e.summary}</p>
              </div>
              <span className="shrink-0 text-xs tabular text-muted-foreground">{formatDateTime(e.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
