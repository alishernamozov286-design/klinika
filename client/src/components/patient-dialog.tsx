import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  IdCard,
  Loader2,
  PhoneCall,
  Send,
  ShieldAlert,
  UserCheck,
  UserPlus,
} from "lucide-react";
import {
  insertPatientSchema,
  localDayString,
  type DuplicateCandidate,
  type Patient,
  type PatientDetails,
  type TelegramPhoneStatus,
} from "@shared/schema";
import { ageFromBirthDate, normalizePinfl } from "@shared/patient-identity";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/inputs";
import { PatientNumber } from "@/components/ui-kit";
import { ApiError, apiRequest, invalidateApi } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDebounced } from "@/hooks/use-debounced";
import { formatDate, formatPhone, isCompletePhone, phoneE164 } from "@/lib/format";
import { cn } from "@/lib/utils";
import { z } from "zod";

const optionalPhone = z
  .string()
  .refine((v) => !v || isCompletePhone(v), "Telefon raqamini to'liq kiriting: +998 XX XXX XX XX");

const formSchema = z
  .object({
    fullName: z.string().trim().min(3, "F.I.Sh kamida 3 ta belgidan iborat bo'lishi kerak"),
    // The mask guarantees the shape; this catches a half-typed number.
    phone: z.string().refine(isCompletePhone, "Telefon raqamini to'liq kiriting: +998 XX XXX XX XX"),
    birthDate: z.string(),
    age: z.union([z.coerce.number().int().min(0, "Yoshni tekshiring").max(130, "Yoshni tekshiring"), z.literal("")]),
    gender: z.union([z.enum(["erkak", "ayol"]), z.literal("")]),
    address: z.string(),
    passport: z.string(),
    pinfl: z.string().refine((v) => !normalizePinfl(v) || /^\d{14}$/.test(normalizePinfl(v)!), "JShShIR 14 ta raqam"),
    contactName: z.string(),
    contactRelation: z.string(),
    contactPhone: optionalPhone,
  })
  .refine((v) => !v.contactPhone || v.contactName.trim().length >= 2, {
    message: "Aloqa uchun shaxs ismini kiriting",
    path: ["contactName"],
  })
  .refine((v) => !v.contactName.trim() || Boolean(v.contactPhone), {
    message: "Aloqa uchun telefon raqamini kiriting",
    path: ["contactPhone"],
  });

type FormValues = z.input<typeof formSchema>;

const EMPTY: FormValues = {
  fullName: "",
  phone: "",
  birthDate: "",
  age: "",
  gender: "",
  address: "",
  passport: "",
  pinfl: "",
  contactName: "",
  contactRelation: "",
  contactPhone: "",
};

const RELATIONS = ["Onasi", "Otasi", "Turmush o'rtog'i", "Farzandi", "Aka-ukasi", "Opa-singlisi", "Qarindoshi"];

/**
 * Register or edit a patient (TZ §4.1.2).
 *
 * While the registrar types, the form asks the server whether this person is
 * already on file and shows the matches — picking one returns the existing
 * card instead of making a second. A strong match also blocks the save on the
 * server, so the registrar has to say explicitly that it is someone else.
 */
export function PatientDialog({
  open,
  onOpenChange,
  patient,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode, absent = create mode. */
  patient?: Patient | null;
  /** Called with the saved card — or with an existing card the registrar picked instead. */
  onSaved?: (patient: Patient) => void;
}) {
  const { toast } = useToast();
  const isEdit = Boolean(patient);
  const [showDocs, setShowDocs] = useState(false);
  const [showContact, setShowContact] = useState(false);
  /** Set after the server refused a save as a likely duplicate. */
  const [blocked, setBlocked] = useState<DuplicateCandidate[] | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: EMPTY });

  // Edit mode loads the full card for the contact and documents.
  const { data: details } = useQuery<PatientDetails>({
    queryKey: [`/api/patients/${patient?.id}`],
    enabled: open && Boolean(patient?.id),
    staleTime: 0,
  });

  useEffect(() => {
    if (!open) return;
    const p = details ?? patient;
    const contact = details?.contacts.find((c) => c.isEmergency);
    form.reset({
      fullName: p?.fullName ?? "",
      // Older rows may hold an unformatted number; normalise on open.
      phone: p?.phone ? formatPhone(p.phone, true) : "",
      birthDate: p?.birthDate ?? "",
      age: p?.birthDate ? "" : (p?.age ?? ""),
      gender: (p?.gender as "erkak" | "ayol" | null) ?? "",
      address: p?.address ?? "",
      passport: p?.passport ?? "",
      pinfl: p?.pinfl ?? "",
      contactName: contact?.name ?? "",
      contactRelation: contact?.relation ?? "",
      contactPhone: contact?.phone ? formatPhone(contact.phone, true) : "",
    });
    setShowDocs(Boolean(p?.passport || p?.pinfl));
    setShowContact(Boolean(contact));
    setBlocked(null);
  }, [open, patient, details, form]);

  const values = form.watch();
  const birthAge = ageFromBirthDate(values.birthDate || null);

  // ---------------------------------------------------- live duplicate check
  const probe = useDebounced(
    JSON.stringify({
      fullName: values.fullName.trim(),
      phone: isCompletePhone(values.phone) ? values.phone : undefined,
      birthDate: values.birthDate || undefined,
      passport: values.passport.trim() || undefined,
      pinfl: normalizePinfl(values.pinfl) ?? undefined,
      excludeId: patient?.id,
    }),
    500,
  );
  const probeBody = useMemo(() => JSON.parse(probe) as Record<string, string | undefined>, [probe]);
  const probeReady =
    open &&
    ((probeBody.fullName?.length ?? 0) >= 5 || Boolean(probeBody.phone || probeBody.passport || probeBody.pinfl));
  const { data: matches = [] } = useQuery<DuplicateCandidate[]>({
    queryKey: ["/api/patients/check-duplicates", probe],
    queryFn: async () => (await apiRequest("POST", "/api/patients/check-duplicates", probeBody)).json(),
    enabled: probeReady,
    staleTime: 30_000,
  });
  const shown = blocked ?? matches;

  // ------------------------------------------------------------ telegram
  // Live answer to "has this person already opened the bot?".
  const typedPhone = useDebounced(values.phone ?? "", 400);
  const phoneReady = open && isCompletePhone(typedPhone);
  const { data: telegram, isFetching: telegramLoading } = useQuery<TelegramPhoneStatus>({
    queryKey: [`/api/telegram/phone?phone=${encodeURIComponent(phoneE164(typedPhone))}`],
    enabled: phoneReady,
  });
  const { data: botInfo } = useQuery<{ enabled: boolean; username: string | null }>({
    queryKey: ["/api/telegram/status"],
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async ({ v, allowDuplicate }: { v: FormValues; allowDuplicate: boolean }) => {
      const hasContact = Boolean(v.contactName.trim() && v.contactPhone);
      const payload = {
        fullName: v.fullName,
        phone: v.phone,
        birthDate: v.birthDate || null,
        age: v.birthDate ? null : v.age === "" || v.age == null ? null : Number(v.age),
        gender: v.gender || null,
        address: v.address || null,
        passport: v.passport || null,
        pinfl: v.pinfl || null,
        emergencyContact: hasContact
          ? { name: v.contactName, relation: v.contactRelation || null, phone: v.contactPhone }
          : null,
        allowDuplicate: allowDuplicate || undefined,
      };
      // The server's own rules, so the form and the API cannot disagree.
      const parsed = insertPatientSchema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Ma'lumotlarni tekshiring");
      const res = isEdit
        ? await apiRequest("PATCH", `/api/patients/${patient!.id}`, payload)
        : await apiRequest("POST", "/api/patients", payload);
      return (await res.json()) as Patient;
    },
    onSuccess: (saved) => {
      invalidateApi("/api/patients", "/api/stats");
      const justLinked = Boolean(saved.telegramChatId) && !patient?.telegramChatId;
      // The number is what the registrar reads back to the patient, so it
      // leads the title on create.
      toast({
        title: isEdit ? "Bemor ma'lumotlari yangilandi" : `Bemor ro'yxatdan o'tkazildi — №${saved.patientNumber}`,
        description: justLinked ? `${saved.fullName} · Telegram ulandi ✅` : saved.fullName,
      });
      onOpenChange(false);
      onSaved?.(saved);
    },
    onError: (err: Error) => {
      if (err instanceof ApiError && err.body?.code === "DUPLICATE_PATIENT") {
        setBlocked((err.body.candidates as DuplicateCandidate[]) ?? []);
        // The warning sits above the fields; bring it into view.
        formRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      toast({ variant: "destructive", title: "Saqlanmadi", description: err.message });
    },
  });

  const pickExisting = (p: Patient) => {
    toast({ title: "Mavjud karta tanlandi", description: `№${p.patientNumber} ${p.fullName}` });
    onOpenChange(false);
    onSaved?.(p);
  };

  const submit = (allowDuplicate: boolean) =>
    form.handleSubmit((v) => mutation.mutate({ v, allowDuplicate }))();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94vh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="icon-tile h-10 w-10 bg-primary/10 text-primary">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2">
                {isEdit ? "Bemor ma'lumotlari" : "Yangi bemor"}
                {isEdit && <PatientNumber value={patient?.patientNumber} size="sm" />}
              </DialogTitle>
              <DialogDescription className="mt-0.5">
                F.I.Sh va telefon majburiy, qolgani ixtiyoriy.
                {!isEdit && " Bemor raqami saqlagandan keyin avtomatik beriladi."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form
            ref={formRef}
            id="patient-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(false);
            }}
            className="flex-1 space-y-5 overflow-y-auto px-6 py-5"
          >
            {/* ------------------------------------------ possible duplicates */}
            {shown.length > 0 && (
              <DuplicatePanel
                candidates={shown}
                blocked={Boolean(blocked)}
                isEdit={isEdit}
                onPick={pickExisting}
              />
            )}

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>F.I.Sh</FormLabel>
                  <FormControl>
                    <Input placeholder="Aliyev Vali Akramovich" autoComplete="off" data-testid="input-fullname" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefon</FormLabel>
                    <FormControl>
                      <PhoneInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} data-testid="input-phone" />
                    </FormControl>
                    <FormMessage />
                    {botInfo?.enabled && phoneReady && !telegramLoading && (
                      <p
                        className={cn(
                          "flex items-start gap-1.5 text-xs",
                          telegram?.connected ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                        )}
                        data-testid="text-telegram-hint"
                      >
                        <Send className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>
                          {telegram?.source === "pending"
                            ? `Botga /start bergan${telegram.telegramName ? ` (${telegram.telegramName})` : ""} — saqlagach avtomatik ulanadi`
                            : telegram?.connected
                              ? "Botga ulangan — natijalar Telegramga yuboriladi"
                              : `Botga /start bermagan${botInfo.username ? ` — @${botInfo.username}` : ""}`}
                        </span>
                      </p>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jinsi</FormLabel>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(["erkak", "ayol"] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => field.onChange(field.value === g ? "" : g)}
                          className={cn(
                            "h-10 rounded-lg border text-sm font-medium transition-colors",
                            field.value === g
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted/50",
                          )}
                          data-testid={`gender-${g}`}
                        >
                          {g === "erkak" ? "Erkak" : "Ayol"}
                        </button>
                      ))}
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="birthDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tug'ilgan sana</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        max={localDayString(new Date())}
                        data-testid="input-birthdate"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e.target.value);
                          if (e.target.value) form.setValue("age", "");
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      {birthAge !== null ? `${birthAge} yosh` : "Yosh shu sanadan avtomatik hisoblanadi"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={cn(values.birthDate && "text-muted-foreground")}>
                      Yoki taxminiy yosh
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={130}
                        placeholder={values.birthDate ? "—" : "35"}
                        disabled={Boolean(values.birthDate)}
                        data-testid="input-age"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormDescription>Sana noma'lum bo'lsa</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Manzil</FormLabel>
                  <FormControl>
                    <Input placeholder="Toshkent sh., Chilonzor t." data-testid="input-address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ------------------------------------------------- documents */}
            <Section
              icon={IdCard}
              title="Shaxsni tasdiqlovchi hujjat"
              hint="Takroriy bemorni aniq ajratish uchun"
              open={showDocs}
              onToggle={() => setShowDocs((o) => !o)}
              testId="section-documents"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="passport"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pasport / ID karta</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="AA1234567"
                          autoComplete="off"
                          className="uppercase"
                          data-testid="input-passport"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pinfl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>JShShIR</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          maxLength={14}
                          placeholder="14 ta raqam"
                          autoComplete="off"
                          className="tabular"
                          data-testid="input-pinfl"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 14))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Section>

            {/* ------------------------------------------ emergency contact */}
            <Section
              icon={PhoneCall}
              title="Favqulodda aloqa"
              hint="Bemor bilan bog'lanib bo'lmasa, kimga qo'ng'iroq qilish"
              open={showContact}
              onToggle={() => setShowContact((o) => !o)}
              testId="section-contact"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ismi</FormLabel>
                      <FormControl>
                        <Input placeholder="Aliyeva Malika" data-testid="input-contact-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactRelation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kim bo'ladi</FormLabel>
                      <FormControl>
                        <Input list="relation-options" placeholder="Onasi" {...field} />
                      </FormControl>
                      <datalist id="relation-options">
                        {RELATIONS.map((r) => (
                          <option key={r} value={r} />
                        ))}
                      </datalist>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Telefon</FormLabel>
                      <FormControl>
                        <PhoneInput
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          data-testid="input-contact-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Section>
          </form>
        </Form>

        <DialogFooter className="flex-col gap-2 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:space-x-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          {blocked ? (
            <Button
              variant="destructive"
              onClick={() => void submit(true)}
              disabled={mutation.isPending}
              data-testid="button-save-anyway"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Bu boshqa odam — baribir saqlash
            </Button>
          ) : (
            <Button type="submit" form="patient-form" disabled={mutation.isPending} data-testid="button-save-patient">
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Saqlash" : "Ro'yxatdan o'tkazish"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A collapsible group of optional fields, so the common case stays short. */
function Section({
  icon: Icon,
  title,
  hint,
  open,
  onToggle,
  children,
  testId,
}: {
  icon: typeof IdCard;
  title: string;
  hint: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
        data-testid={testId}
      >
        <div className="icon-tile h-8 w-8 bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{hint}</p>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="border-t px-4 py-4">{children}</div>}
    </section>
  );
}

/**
 * Who this might already be. Amber while typing; red once the server has
 * refused the save, when the registrar must either pick a card or confirm.
 */
function DuplicatePanel({
  candidates,
  blocked,
  isEdit,
  onPick,
}: {
  candidates: DuplicateCandidate[];
  blocked: boolean;
  isEdit: boolean;
  onPick: (p: Patient) => void;
}) {
  const strong = candidates.some((c) => c.strength === "strong");
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5",
        blocked
          ? "border-rose-500/30 bg-rose-500/[0.06]"
          : strong
            ? "border-amber-500/30 bg-amber-500/[0.07]"
            : "border-sky-500/25 bg-sky-500/[0.05]",
      )}
      data-testid="panel-duplicates"
    >
      <div className="flex items-start gap-2.5">
        {blocked ? (
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
        ) : (
          <AlertTriangle
            className={cn("mt-0.5 h-4 w-4 shrink-0", strong ? "text-amber-600 dark:text-amber-400" : "text-sky-600 dark:text-sky-400")}
          />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {blocked
              ? "Bu bemor bazada bor bo'lishi mumkin"
              : strong
                ? "Bazada shu bemorga juda o'xshash karta bor"
                : "O'xshash bemorlar topildi"}
          </p>
          <p className="text-xs text-muted-foreground">
            {blocked
              ? "Agar shu odam bo'lsa, mavjud kartani tanlang. Ikkinchi karta ochilsa, tarixi ikkiga bo'linib ketadi."
              : "Ikkinchi karta ochmaslik uchun tekshiring."}
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {candidates.map((c) => (
          <div key={c.patient.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                <span className="tabular text-muted-foreground">№{c.patient.patientNumber}</span> {c.patient.fullName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {formatPhone(c.patient.phone)}
                {c.patient.birthDate && ` · ${formatDate(c.patient.birthDate)}`}
                {" · "}
                <span className={c.strength === "strong" ? "font-medium text-amber-700 dark:text-amber-300" : ""}>
                  {c.reasons.join(", ")}
                </span>
              </p>
            </div>
            {!isEdit && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => onPick(c.patient)}
                data-testid={`button-pick-${c.patient.patientNumber}`}
              >
                <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                Shu bemor
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
