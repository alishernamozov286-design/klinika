/**
 * Sozlamalar → MKB-10 (B3.4, D-5): the catalogue, and the clinic's Uzbek
 * names for it. Russian names come from the Ministry of Health reference and
 * are not edited here; Uzbek names are entered one by one or imported from
 * the clinic's file.
 */
import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BookOpenText, Check, FileUp, Languages, Loader2, Pencil, X } from "lucide-react";
import type { IcdEntry, IcdStats } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MeterBar, SectionCard, EmptyState } from "@/components/ui-kit";
import { SearchInput } from "@/components/inputs";
import { apiRequest, invalidateApi } from "@/lib/queryClient";
import { useDebounced } from "@/hooks/use-debounced";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const KIND_LABELS: Record<IcdEntry["kind"], string> = {
  chapter: "Bob",
  block: "Blok",
  category: "Rubrika",
  subcategory: "Kod",
};

type ImportResult = { updated: number; unknownCount: number; unknown: string[]; rejectedCount: number; rejectedLines: number[] };

export function IcdPanel() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 250);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { data: stats } = useQuery<IcdStats>({ queryKey: ["/api/icd10/stats"], refetchOnMount: "always" });
  const { data: rows = [], isFetching } = useQuery<IcdEntry[]>({
    queryKey: [`/api/icd10?q=${encodeURIComponent(q)}&limit=60&all=1`],
    enabled: q.length >= 1,
  });

  const save = useMutation({
    mutationFn: async (v: { code: string; nameUz: string }) => {
      await apiRequest("PATCH", `/api/icd10/${encodeURIComponent(v.code)}`, { nameUz: v.nameUz.trim() || null });
    },
    onSuccess: () => {
      invalidateApi("/api/icd10");
      setEditing(null);
      toast({ title: "O'zbekcha nom saqlandi" });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Saqlanmadi", description: err.message }),
  });

  const importFile = useMutation({
    mutationFn: async (csv: string) => (await (await apiRequest("POST", "/api/icd10/import-uz", { csv })).json()) as ImportResult,
    onSuccess: (r) => {
      invalidateApi("/api/icd10");
      setResult(r);
      toast({ title: "Import tugadi", description: `${r.updated} ta kodga o'zbekcha nom yozildi` });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: "Import bo'lmadi", description: err.message }),
  });

  return (
    <div className="space-y-6">
      <SectionCard icon={BookOpenText} title="MKB-10 katalogi" description="Kasalliklarning xalqaro tasnifi, 10-qayta ko'rib chiqilgan nashr">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span>
                Jami: <b className="tabular">{stats?.total.toLocaleString("ru-RU") ?? "—"}</b>
              </span>
              <span>
                Tanlanadigan kodlar: <b className="tabular">{stats?.selectable.toLocaleString("ru-RU") ?? "—"}</b>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Ruscha nomlar manbasi: {stats?.source || "—"}</p>
            {stats && stats.total === 0 && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                Katalog bazaga yuklanmagan. Administrator <code className="font-mono">npm run db:icd10</code> buyrug'ini bajarishi kerak.
              </p>
            )}
          </div>
          <div className="space-y-3">
            <MeterBar
              value={stats?.withUzbek ?? 0}
              max={stats?.selectable || 1}
              barClassName="bg-none bg-emerald-500"
              label={
                <>
                  <span className="inline-flex items-center gap-1">
                    <Languages className="h-3.5 w-3.5" />
                    O'zbekcha nomi bor
                  </span>
                  <span className="tabular">
                    {stats?.withUzbek ?? 0} / {stats?.selectable ?? 0}
                  </span>
                </>
              }
            />
            <p className="text-xs text-muted-foreground">
              Rasmiy o'zbekcha nashr ochiq manbada topilmadi. O'zbekcha nomni quyida qo'lda kiriting yoki klinika faylini import qiling.
              Nomi bo'lmagan kodda ruscha nom ko'rsatiladi.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,text/csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  importFile.mutate(await file.text());
                }}
                data-testid="input-icd-import"
              />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importFile.isPending} data-testid="button-icd-import">
                {importFile.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileUp className="mr-1.5 h-3.5 w-3.5" />}
                O'zbekcha nomlarni import qilish (CSV)
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Format: <code className="font-mono">kod;o'zbekcha nom</code>, masalan <code className="font-mono">I10;Essensial gipertenziya</code>
              </span>
            </div>
            {result && (
              <p className="rounded-lg border bg-muted/30 p-2.5 text-xs" data-testid="text-icd-import-result">
                Yozildi: <b>{result.updated}</b> ta kod.
                {result.unknownCount > 0 && <> Katalogda yo'q kodlar: {result.unknownCount} ({result.unknown.slice(0, 8).join(", ")}{result.unknownCount > 8 ? "…" : ""}).</>}
                {result.rejectedCount > 0 && <> O'qilmagan qatorlar: {result.rejectedLines.slice(0, 10).join(", ")}{result.rejectedCount > 10 ? "…" : ""}.</>}
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={Languages} title="Kodlar" description="Kod yoki nom bo'yicha qidiring; o'zbekcha nomni shu yerda tahrirlang" flush>
        <div className="border-b p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Masalan: I10, E11, gipert, гипертен…" className="sm:w-96" data-testid="input-icd-search" />
        </div>
        {q.length === 0 ? (
          <EmptyState icon={BookOpenText} title="Qidiruvni boshlang" description="Kod (I10, E11.9) yoki kasallik nomidan bir qismini yozing." />
        ) : rows.length === 0 ? (
          <EmptyState icon={BookOpenText} title={isFetching ? "Qidirilmoqda…" : "Topilmadi"} />
        ) : (
          <div className="divide-y">
            {rows.map((r) => (
              <div key={r.code} className={cn("flex flex-wrap items-start gap-3 px-5 py-3", !r.isActual && "opacity-60")} data-testid={`icd-row-${r.code}`}>
                <div className="w-20 shrink-0">
                  <p className="font-mono text-sm font-bold text-primary">{r.code}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{KIND_LABELS[r.kind]}</p>
                </div>
                <div className="min-w-0 flex-1 basis-64 space-y-1">
                  <p className="text-sm">{r.nameRu}</p>
                  {editing === r.code ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") save.mutate({ code: r.code, nameUz: draft });
                          if (e.key === "Escape") setEditing(null);
                        }}
                        placeholder="O'zbekcha nomi"
                        maxLength={400}
                        autoFocus
                        className="h-8 text-sm"
                        data-testid={`input-icd-uz-${r.code}`}
                      />
                      <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => save.mutate({ code: r.code, nameUz: draft })} disabled={save.isPending} aria-label="Saqlash" data-testid={`button-icd-save-${r.code}`}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditing(null)} aria-label="Bekor qilish">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : r.nameUz ? (
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">{r.nameUz}</p>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">O'zbekcha nomi kiritilmagan</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!r.isActual && <Badge variant="outline">eskirgan</Badge>}
                  {editing !== r.code && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(r.code);
                        setDraft(r.nameUz ?? "");
                      }}
                      data-testid={`button-icd-edit-${r.code}`}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      O'zbekcha
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
