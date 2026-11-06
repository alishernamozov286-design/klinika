import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BadgeCheck, CheckCircle2, ClipboardCheck, ClipboardList, Clock, Printer, ShieldCheck, Undo2 } from "lucide-react";
import type { OrderListResponse, OrderWithDetails } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Avatar,
  EmptyState,
  PageHeader,
  Pagination,
  ProgressRing,
  SampleBadge,
  StatusBadge,
  TableSkeleton,
} from "@/components/ui-kit";
import { SearchInput } from "@/components/inputs";
import { ExportButtons } from "@/components/export-buttons";
import type { ExportColumn } from "@/lib/export-types";
import { ResultsDialog } from "@/components/results-dialog";
import { PrintDialog } from "@/components/print-dialog";
import { OrderDetailDialog } from "@/components/order-detail-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useDebounced } from "@/hooks/use-debounced";
import { FLAG_LABELS, formatDate, formatTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LINE_STATE_LABELS, labProgress, lineState } from "@shared/lab-verification";

type Queue = "waiting" | "review" | "ready";

const QUEUE_COPY: Record<Queue, { file: string; title: string; empty: string; emptyHint: string }> = {
  waiting: {
    file: "natijalar-kiritish",
    title: "Kiritilishi kerak bo'lgan natijalar",
    empty: "Navbatda hech narsa yo'q",
    emptyHint: "Barcha natijalar kiritilgan. Yangi buyurtma yoki qaytarilgan natija kelganda shu yerda paydo bo'ladi.",
  },
  review: {
    file: "natijalar-tasdiqlash",
    title: "Tasdiqlash kutayotgan natijalar",
    empty: "Tasdiqlash kutayotgan natija yo'q",
    emptyHint: "Laborant natija kiritgach, laboratoriya mudiri uni shu yerda tekshiradi.",
  },
  ready: {
    file: "natijalar-tayyor",
    title: "Tasdiqlangan natijalar",
    empty: "Tasdiqlangan natija yo'q",
    emptyHint: "Laboratoriya mudiri tasdiqlagan natijalar blanka uchun shu yerda to'planadi.",
  },
};

const PAGE_SIZE = 24;

/**
 * One row per test rather than per order. The screen groups tests into order
 * cards, but a results export is read test-by-test — a doctor scanning for
 * out-of-range values needs each analyte on its own line.
 */
type ResultRow = {
  orderNumber: number;
  barcode: string;
  patientName: string;
  createdAt: string | Date;
  testName: string;
  result: string;
  unit: string;
  referenceRange: string;
  flag: string;
  enteredBy: string;
  state: string;
  verifiedBy: string;
};

function toResultRows(orders: OrderWithDetails[]): ResultRow[] {
  return orders.flatMap((order) =>
    order.items.map((item) => ({
      orderNumber: order.orderNumber,
      barcode: order.sample?.barcode ?? "",
      patientName: order.patient?.fullName ?? "",
      createdAt: order.createdAt,
      testName: item.testName,
      result: item.result ?? "",
      unit: item.unit ?? "",
      referenceRange: item.referenceRange ?? "",
      flag: item.flag ? FLAG_LABELS[item.flag] : "",
      enteredBy: item.enteredBy ?? "",
      state: LINE_STATE_LABELS[lineState(item)],
      verifiedBy: item.verifiedByName ?? "",
    })),
  );
}

const EXPORT_COLUMNS: ExportColumn<ResultRow>[] = [
  { header: "Buyurtma №", value: (r) => r.orderNumber, type: "number", width: 12 },
  { header: "Barcode", value: (r) => r.barcode, width: 14 },
  { header: "Bemor", value: (r) => r.patientName, width: 26 },
  { header: "Sana", value: (r) => formatDate(r.createdAt), width: 12 },
  { header: "Tahlil", value: (r) => r.testName, width: 30 },
  { header: "Natija", value: (r) => r.result, width: 14 },
  { header: "Birlik", value: (r) => r.unit, width: 12 },
  { header: "Me'yor", value: (r) => r.referenceRange, width: 18 },
  { header: "Holat", value: (r) => r.flag, width: 12 },
  { header: "Laborant", value: (r) => r.enteredBy, width: 22 },
  { header: "Holati", value: (r) => r.state, width: 20 },
  { header: "Tasdiqladi", value: (r) => r.verifiedBy, width: 22 },
];

/**
 * The lab's workbench (TZ §6.1.4–6.1.5): values to enter (the laborant), values
 * to check (the lab head), and verified orders ready for the blank.
 */
export default function Results() {
  const { can } = useAuth();
  const canVerify = can("results.verify");
  // The lab head lands on their own queue: checking is their job, even when
  // they may also enter values.
  // The lab board links straight to a queue (?queue=review).
  const [queue, setQueue] = useState<Queue>(() => {
    const asked = new URLSearchParams(window.location.search).get("queue");
    if (asked === "waiting" || asked === "review" || asked === "ready") return asked;
    return canVerify ? "review" : "waiting";
  });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<OrderWithDetails | null>(null);
  const [printing, setPrinting] = useState<OrderWithDetails | null>(null);
  const [detail, setDetail] = useState<OrderWithDetails | null>(null);

  const debouncedSearch = useDebounced(search.trim(), 300);
  useEffect(() => setPage(0), [debouncedSearch, queue]);

  // The waiting/ready split is a server-side filter, so a busy day's backlog
  // never has to be shipped to the browser in full.
  const params = new URLSearchParams({
    search: debouncedSearch,
    queue,
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
  });

  const { data, isLoading, isFetching } = useQuery<OrderListResponse>({
    queryKey: [`/api/orders?${params.toString()}`],
    placeholderData: keepPreviousData,
  });

  const list = data?.items ?? [];
  const total = data?.total ?? 0;
  const queueCounts = data?.summary.results ?? { waiting: 0, review: 0, ready: 0 };
  const copy = QUEUE_COPY[queue];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Laboratoriya"
        title="Natijalar"
        description={
          [
            queueCounts.waiting > 0 ? `${queueCounts.waiting} ta buyurtmada kiritish kerak` : null,
            queueCounts.review > 0 ? `${queueCounts.review} ta buyurtma tasdiqlashni kutmoqda` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Barcha natijalar kiritilgan va tasdiqlangan"
        }
        actions={
          <ExportButtons
            testIdPrefix="export-results"
            disabled={isLoading}
            build={() => ({
              filename: copy.file,
              title: copy.title,
              subtitle: [
                debouncedSearch ? `Qidiruv: "${debouncedSearch}"` : null,
                `${list.length} ta buyurtma (${page + 1}-sahifa, jami ${total} ta)`,
              ]
                .filter(Boolean)
                .join(" · "),
              columns: EXPORT_COLUMNS,
              rows: toResultRows(list),
            })}
          />
        }
      />

      <div className="card-premium flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={queue} onValueChange={(v) => setQueue(v as Queue)}>
          <TabsList>
            <TabsTrigger value="waiting" data-testid="tab-waiting">
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              Kiritish
              <Badge variant="secondary" className="ml-2 tabular">{queueCounts.waiting}</Badge>
            </TabsTrigger>
            <TabsTrigger value="review" data-testid="tab-review">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              Tasdiqlash
              <Badge variant="secondary" className={cn("ml-2 tabular", queueCounts.review > 0 && "bg-amber-500/15 text-amber-800 dark:text-amber-300")}>
                {queueCounts.review}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="ready" data-testid="tab-ready">
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Tayyor
              <Badge variant="secondary" className="ml-2 tabular">{queueCounts.ready}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Bemor, telefon, № yoki tahlil..."
          className="lg:w-80"
          data-testid="input-search-results"
        />
      </div>

      {isLoading ? (
        <div className="card-premium">
          <TableSkeleton />
        </div>
      ) : list.length === 0 ? (
        <div className="card-premium">
          <EmptyState
            icon={queue === "ready" ? ClipboardList : CheckCircle2}
            title={copy.empty}
            description={copy.emptyHint}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((order) => {
            const p = labProgress(order.items);
            return (
              <article key={order.id} className="card-premium flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setDetail(order)}
                    className="flex min-w-0 items-center gap-3 text-left"
                  >
                    <Avatar name={order.patient?.fullName ?? "??"} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{order.patient?.fullName ?? "—"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="tabular">#{order.orderNumber}</span> · {timeAgo(order.createdAt)}
                      </p>
                    </div>
                  </button>
                  <ProgressRing value={queue === "waiting" ? p.total - p.empty : p.verified} max={p.total} />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {order.items.slice(0, 4).map((item) => {
                    const state = lineState(item);
                    return (
                      <Badge
                        key={item.id}
                        variant="secondary"
                        title={state === "returned" ? `Qaytarildi: ${item.returnReason}` : undefined}
                        className={cn(
                          "max-w-full gap-1 truncate text-xs font-normal",
                          state === "verified" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                          state === "review" && "bg-amber-500/10 text-amber-800 dark:text-amber-300",
                          state === "returned" && "bg-rose-500/10 text-rose-700 dark:text-rose-300",
                        )}
                      >
                        {state === "verified" && <BadgeCheck className="h-3 w-3 shrink-0" />}
                        {state === "returned" && <Undo2 className="h-3 w-3 shrink-0" />}
                        {item.testName}
                      </Badge>
                    );
                  })}
                  {order.items.length > 4 && (
                    <Badge variant="outline" className="text-xs">+{order.items.length - 4}</Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={order.status} />
                    {/* The tube's state, on the card rather than one click in:
                        this is the queue where someone decides what to run
                        next, and a rejected tube must be visible before it is
                        picked up. */}
                    {order.sample && <SampleBadge status={order.sample.status} />}
                    {p.returned > 0 && (
                      <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300">
                        {p.returned} ta qaytarilgan
                      </Badge>
                    )}
                  </div>
                  <span className="tabular">
                    {formatDate(order.createdAt)} · {formatTime(order.createdAt)}
                  </span>
                </div>

                <div className="mt-auto flex gap-2">
                  {(can("results.enter") || canVerify) && (
                    <Button
                      variant={queue === "ready" ? "outline" : "default"}
                      className={cn("flex-1", queue === "review" && canVerify && "bg-emerald-600 text-white hover:bg-emerald-700")}
                      onClick={() => setEditing(order)}
                      data-testid={`button-enter-results-${order.orderNumber}`}
                    >
                      {queue === "review" && canVerify ? <BadgeCheck className="mr-2 h-4 w-4" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
                      {queue === "waiting" ? "Kiritish" : queue === "review" && canVerify ? "Tekshirish" : "Ochish"}
                    </Button>
                  )}
                  <Button
                    variant={queue === "ready" ? "default" : "outline"}
                    className={can("results.enter") || canVerify ? "" : "flex-1"}
                    onClick={() => setPrinting(order)}
                    disabled={p.verified === 0}
                    title={p.verified === 0 ? "Tasdiqlangan natija yo'q" : undefined}
                    data-testid={`button-print-${order.orderNumber}`}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Blanka
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="card-premium overflow-hidden">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            isFetching={isFetching}
            className="border-t-0"
          />
        </div>
      )}

      <ResultsDialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} order={editing} />
      <PrintDialog open={Boolean(printing)} onOpenChange={(o) => !o && setPrinting(null)} order={printing} />
      <OrderDetailDialog
        open={Boolean(detail)}
        onOpenChange={(o) => !o && setDetail(null)}
        order={detail}
        onEnterResults={(o) => {
          setDetail(null);
          setEditing(o);
        }}
        onPrint={(o) => {
          setDetail(null);
          setPrinting(o);
        }}
      />
    </div>
  );
}
