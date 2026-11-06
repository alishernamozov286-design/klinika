import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  Database,
  FlaskConical,
  GitMerge,
  IdCard,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import type { Patient, PatientListItem } from "@shared/schema";
import { patientAge } from "@shared/patient-identity";
import { MergePatientDialog } from "@/components/merge-patient-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Avatar,
  EmptyState,
  PageHeader,
  Pagination,
  PatientNumber,
  PhoneText,
  TableSkeleton,
  TelegramBadge,
} from "@/components/ui-kit";
import { SearchInput } from "@/components/inputs";
import { ExportButtons } from "@/components/export-buttons";
import type { ExportColumn } from "@/lib/export-types";
import { PatientDialog } from "@/components/patient-dialog";
import { OrderDialog } from "@/components/order-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useDebounced } from "@/hooks/use-debounced";
import {
  ageGender,
  formatDate,
  formatPhone,
  genderLabel,
  timeAgo,
} from "@/lib/format";

const PAGE_SIZE = 25;

/** Shared by the Excel and PDF writers — see lib/export.ts. */
const EXPORT_COLUMNS: ExportColumn<PatientListItem>[] = [
  { header: "№", value: (p) => p.patientNumber, type: "number", width: 8 },
  { header: "F.I.Sh", value: (p) => p.fullName, width: 30 },
  // Kept as text: a phone number is an identifier, not a quantity, and Excel
  // would otherwise drop the leading +998 and render it in scientific notation.
  { header: "Telefon", value: (p) => formatPhone(p.phone, true), width: 20 },
  { header: "Tug'ilgan sana", value: (p) => (p.birthDate ? formatDate(p.birthDate) : ""), width: 14 },
  { header: "Yosh", value: (p) => patientAge(p) ?? "", type: "number", width: 8 },
  { header: "Jinsi", value: (p) => (p.gender ? genderLabel(p.gender) : ""), width: 10 },
  { header: "Manzil", value: (p) => p.address ?? "", width: 30 },
  { header: "Telegram", value: (p) => (p.telegramChatId ? "Ulangan" : "Yo'q"), width: 12 },
  { header: "Tashriflar", value: (p) => p.visitCount, type: "number", width: 10 },
  { header: "Oxirgi tashrif", value: (p) => (p.lastVisitAt ? formatDate(p.lastVisitAt) : ""), width: 14 },
  { header: "Qo'shilgan", value: (p) => formatDate(p.createdAt), width: 14 },
];

export default function Patients() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { can } = useAuth();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [dialogPatient, setDialogPatient] = useState<Patient | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [orderFor, setOrderFor] = useState<Patient | null>(null);
  const [deleting, setDeleting] = useState<Patient | null>(null);
  const [merging, setMerging] = useState<Patient | null>(null);

  const debouncedSearch = useDebounced(search.trim(), 300);

  // Page 3 of the old result set is meaningless once the query changes.
  useEffect(() => setPage(0), [debouncedSearch]);

  const { data, isLoading, isFetching } = useQuery<{ items: PatientListItem[]; total: number }>({
    queryKey: [
      `/api/patients?search=${encodeURIComponent(debouncedSearch)}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
    ],
    placeholderData: keepPreviousData,
  });

  const patients = data?.items ?? [];
  const total = data?.total ?? 0;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/patients/${id}`);
    },
    onSuccess: () => {
      invalidateApi("/api/patients", "/api/stats", "/api/reception");
      toast({ title: "Bemor o'chirildi" });
      setDeleting(null);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "O'chirilmadi", description: err.message });
    },
  });

  const openCreate = () => {
    setDialogPatient(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bemorlar bazasi"
        title="Bemorlar"
        description="Qidiruv: bemor raqami, ism, telefon, manzil, pasport yoki JShShIR"
        actions={
          <div className="flex items-center gap-2">
            {can("data.export") && (
              <ExportButtons
                testIdPrefix="export-patients"
                disabled={isLoading}
                build={() => ({
                  filename: "bemorlar",
                  title: "Bemorlar ro'yxati",
                  subtitle: debouncedSearch
                    ? `Qidiruv: "${debouncedSearch}" · ${patients.length} ta yozuv (${page + 1}-sahifa)`
                    : `${patients.length} ta yozuv (${page + 1}-sahifa, jami ${total} ta)`,
                  columns: EXPORT_COLUMNS,
                  rows: patients,
                })}
              />
            )}
            {/* Server-side, so the file holds every match rather than the
                25 rows on screen — the form an accountant actually wants. */}
            {can("data.export") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" asChild aria-label="Butun bazani CSV yuklab olish">
                    <a
                      href={`/api/export/patients.csv?search=${encodeURIComponent(debouncedSearch)}`}
                      data-testid="link-export-patients"
                    >
                      <Database className="h-4 w-4" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Butun baza (CSV)</TooltipContent>
              </Tooltip>
            )}
            {can("patients.create") && (
              <Button onClick={openCreate} data-testid="button-add-patient" className="shadow-brand">
                <UserPlus className="mr-2 h-4 w-4" />
                Yangi bemor
              </Button>
            )}
          </div>
        }
      />

      <div className="card-premium flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Raqam (#12), ism, telefon yoki manzil bo'yicha qidiring..."
          className="sm:w-96"
          data-testid="input-search-patients"
        />
        <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Users className="h-4 w-4" />
          )}
          <span className="tabular">{total}</span>
          <span>{debouncedSearch ? "ta natija" : "ta bemor"}</span>
        </div>
      </div>

      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : patients.length === 0 ? (
          <EmptyState
            icon={Users}
            title={debouncedSearch ? "Bemor topilmadi" : "Hali bemor yo'q"}
            description={
              debouncedSearch
                ? "Boshqa so'z bilan qidirib ko'ring yoki qidiruvni tozalang."
                : "Birinchi bemorni ro'yxatdan o'tkazing — keyin unga tahlil buyurtma qilasiz."
            }
            action={
              !debouncedSearch && can("patients.create") ? (
                <Button onClick={openCreate}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Bemor qo'shish
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="table-premium">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">№</TableHead>
                  <TableHead>Bemor</TableHead>
                  <TableHead className="hidden sm:table-cell">Telefon</TableHead>
                  <TableHead className="hidden md:table-cell">Telegram</TableHead>
                  <TableHead className="hidden lg:table-cell">Yosh / Jinsi</TableHead>
                  <TableHead className="hidden xl:table-cell">Manzil</TableHead>
                  <TableHead className="hidden md:table-cell">Oxirgi tashrif</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((p) => (
                  <TableRow key={p.id} data-testid={`row-patient-${p.id}`}>
                    <TableCell>
                      <PatientNumber value={p.patientNumber} />
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setLocation(`/patients/${p.id}`)}
                        className="flex items-center gap-3 text-left"
                      >
                        <Avatar name={p.fullName} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.fullName}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">
                            <PhoneText value={p.phone} asLink={false} />
                          </p>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <PhoneText value={p.phone} className="text-[13px]" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <TelegramBadge chatId={p.telegramChatId} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {ageGender(patientAge(p), p.gender)}
                      {p.birthDate && <span className="block text-[11px] tabular">{formatDate(p.birthDate)}</span>}
                    </TableCell>
                    <TableCell className="hidden max-w-[240px] truncate text-muted-foreground xl:table-cell">
                      {p.address || "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {p.lastVisitAt ? (
                        <div className="text-sm">
                          <span className="text-foreground">{timeAgo(p.lastVisitAt)}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {p.visitCount} ta tashrif
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Tashrif yo'q
                          <span className="block text-[11px] tabular">qo'shilgan {formatDate(p.createdAt)}</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`menu-patient-${p.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => setLocation(`/patients/${p.id}`)}>
                            <IdCard className="mr-2 h-4 w-4" />
                            Bemor kartasi
                          </DropdownMenuItem>
                          {can("orders.create") && (
                            <DropdownMenuItem onClick={() => setOrderFor(p)}>
                              <FlaskConical className="mr-2 h-4 w-4" />
                              Tahlil buyurtma qilish
                            </DropdownMenuItem>
                          )}
                          {can("patients.update") && (
                            <>
                              <DropdownMenuItem
                                onClick={() => {
                                  setDialogPatient(p);
                                  setDialogOpen(true);
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Tahrirlash
                              </DropdownMenuItem>
                            </>
                          )}
                          {can("patients.delete") && (
                            <DropdownMenuItem onClick={() => setMerging(p)} data-testid={`button-merge-${p.id}`}>
                              <GitMerge className="mr-2 h-4 w-4" />
                              Dublikatni birlashtirish
                            </DropdownMenuItem>
                          )}
                          {can("patients.delete") && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleting(p)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              O'chirish
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
          isFetching={isFetching}
        />
      </div>

      <PatientDialog open={dialogOpen} onOpenChange={setDialogOpen} patient={dialogPatient} />
      <OrderDialog
        open={Boolean(orderFor)}
        onOpenChange={(o) => !o && setOrderFor(null)}
        presetPatient={orderFor}
      />
      <MergePatientDialog source={merging} onClose={() => setMerging(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Bemorni o'chirish"
        description={
          <>
            <strong>{deleting?.fullName}</strong> bazadan butunlay o'chiriladi. Buyurtmalari bo'lsa,
            avval ularni o'chirish kerak.
          </>
        }
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
