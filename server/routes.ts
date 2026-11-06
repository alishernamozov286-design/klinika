import type { Express, NextFunction, Request, Response } from "express";
import passport from "passport";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  SAMPLE_STATUS_LABELS,
  changePasswordSchema,
  createOrderSchema,
  createPaymentSchema,
  voidPaymentSchema,
  verifyResultsSchema,
  returnResultsSchema,
  amendResultSchema,
  insertExpenseSchema,
  updateExpenseSchema,
  cancelExpenseSchema,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  insertPatientSchema,
  insertTestSchema,
  insertUserSchema,
  labSettingsSchema,
  loginSchema,
  nationalPhoneDigits,
  saveResultsSchema,
  updateOrderSchema,
  updateSampleSchema,
  updateUserSchema,
  insertRoleSchema,
  updateRoleSchema,
  DEPARTMENT_KIND_LABELS,
  insertDepartmentSchema,
  insertDoctorSchema,
  updateDepartmentSchema,
  updateDoctorSchema,
  securitySettingsSchema,
  mfaCodeSchema,
  mfaDisableSchema,
  mfaPasswordSchema,
  type MfaChallenge,
  type MfaSetup,
  type MfaStatus,
  type User,
  type UserMfa,
  type DuplicateCandidate,
  type InsertPatient,
  type Patient,
  type PublicUser,
  type SessionUser,
} from "@shared/schema";
import {
  PERMISSIONS,
  SUPER_ADMIN,
  SYSTEM_ROLE_KEYS,
  LEGACY_ADMIN,
  PERMISSION_GROUP_LABEL,
  type Permission,
} from "@shared/permissions";
import {
  ATTEMPTS_BEFORE_LOCK,
  attemptsLeftMessage,
  formatLockRemaining,
  isFinalLock,
  lockMessage,
  lockRemainingMs,
  registerFailure,
  registerSuccess,
} from "@shared/lockout";
import {
  clearFailedLogins,
  loginRateLimit,
  recordFailedLogin,
  requireAuth,
  setupAuth,
  forgetSessionUser,
  sessionPool,
  sessionStore,
} from "./auth";
import { csvHeaders, stamp, toCsv } from "./csv";
import { ageFromBirthDate, compareIdentity, nameKey, patientAge } from "@shared/patient-identity";
import { hasPermission, invalidateRoles, isSuperAdmin, requirePermission, toSessionUser } from "./rbac";
import {
  getSessionPolicy,
  invalidateSessionPolicy,
  listUserSessions,
  revokeUserSessions,
  stampSession,
} from "./session-policy";
import { verifyPassword } from "./password";
import QRCode from "qrcode";
import {
  checkMfaCode,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  otpauthUrl,
  verifyTotp,
} from "./mfa";
import { localDay, storage, usingPostgres } from "./storage";
import { StorageConflict, type ExpenseQuery } from "./storage-types";
import {
  claimPendingContact,
  deliverOrderResults,
  notifyIfReady,
  telegramBotInfo,
  telegramEnabled,
  telegramPhoneStatus,
  telegramUsesWebhook,
  telegramWebhook,
} from "./telegram";

import { actorOf, audit, emptyIfMissing, handle, logPatientView, numberParam, stringParam } from "./route-helpers";
import { registerClinicRoutes } from "./routes-clinic";
import { isOrderReleased } from "@shared/lab-verification";
import { SAMPLE_QUALITY_LABELS, isTestGroup, type SampleQuality } from "@shared/lab-catalogue";
import { checkLogo, type ClinicLogo } from "@shared/branding";
import { notifyOrderingDoctor } from "./result-delivery";
import { registerMedicalRoutes } from "./routes-medical";

export async function registerRoutes(app: Express): Promise<void> {
  setupAuth(app);
  console.log(`[db] ${usingPostgres ? "Postgres (Neon)" : "Mahalliy JSON (.data/db.json)"}`);
  const seeded = await storage.seed();
  if (seeded.createdTests) {
    console.log(`[seed] ${seeded.createdTests} ta tahlil narxlar ro'yxatiga yuklandi`);
  }
  if (seeded.createdUsers) {
    console.log("[seed] Standart foydalanuvchilar yaratildi — admin / admin123");
  }

  // -------------------------------------------------------------- telegram

  // Registered before everything else and without auth: the caller is Telegram,
  // not a signed-in user. Requests are authenticated by the bot token in the
  // URL path being unguessable plus, when set, TELEGRAM_WEBHOOK_SECRET.
  // Registering the route is what commits this bot to webhook mode, so it only
  // happens on the deployment that actually receives them; index.ts polls
  // instead. Creating both on one bot is an error grammY refuses outright.
  if (telegramEnabled && telegramUsesWebhook) {
    app.post("/api/telegram/webhook", telegramWebhook());
    console.log("[telegram] webhook yo'li: POST /api/telegram/webhook");
  } else if (!telegramEnabled) {
    console.log("[telegram] TELEGRAM_BOT_TOKEN yo'q — bot o'chirilgan");
  }

  app.get(
    "/api/telegram/status",
    requireAuth,
    handle(async (_req, res) => {
      const info = await telegramBotInfo();
      res.json({ enabled: telegramEnabled, username: info?.username ?? null });
    }),
  );

  /** "Has this number opened the bot?" — shown live in the registration form. */
  app.get(
    "/api/telegram/phone",
    requirePermission("patients.create", "patients.update"),
    handle(async (req, res) => {
      const phone = typeof req.query.phone === "string" ? req.query.phone : "";
      res.json(await telegramPhoneStatus(phone));
    }),
  );

  // ------------------------------------------------------------------ auth

  // ------------------------------------------------------ sign-in helpers

  const MFA_PENDING_TTL_MS = 5 * 60_000;
  const MFA_SETUP_TTL_MS = 10 * 60_000;
  /** Misses allowed on one pending sign-in before the password is asked again. */
  const MFA_MAX_ATTEMPTS = 5;
  const MFA_NOT_MIGRATED =
    "Ikki bosqichli kirish uchun ma'lumotlar bazasi yangilanmagan. Administrator npm run db:mfa ni bajarishi kerak";

  /** The role must use 2FA — and 2FA can actually be stored, or the user would be stuck. */
  const mfaRequiredFor = async (role: string) =>
    (await getSessionPolicy()).mfaRequiredRoles.includes(role) && (await storage.mfaAvailable());

  const mfaStatusOf = async (userId: string, role: string): Promise<MfaStatus> => {
    const [record, available, policy] = await Promise.all([
      storage.getUserMfa(userId),
      storage.mfaAvailable(),
      getSessionPolicy(),
    ]);
    return {
      enabled: Boolean(record),
      enabledAt: record?.enabledAt ?? null,
      recoveryCodesLeft: record?.recoveryCodes.length ?? 0,
      required: policy.mfaRequiredRoles.includes(role),
      available,
    };
  };

  /**
   * Checks a code and spends it in the same breath. The spending is an atomic
   * conditional update in storage, so two requests racing with one code
   * cannot both get through.
   */
  const verifyAndConsume = async (
    record: UserMfa,
    code: string,
  ): Promise<"totp" | "recovery" | "invalid" | "unreadable"> => {
    const check = checkMfaCode(record, code);
    if (!check.ok) return check.reason;
    const spent =
      check.kind === "totp"
        ? await storage.consumeMfaStep(record.userId, check.step)
        : await storage.consumeRecoveryCode(record.userId, check.hash);
    return spent ? check.kind : "invalid";
  };

  const codeAccepted = (r: Awaited<ReturnType<typeof verifyAndConsume>>) => r === "totp" || r === "recovery";

  /** The last step of every sign-in, with or without a second factor. */
  const completeLogin = (
    req: Request,
    res: Response,
    next: NextFunction,
    user: SessionUser,
    account: User | undefined,
    opts: { mustEnrol: boolean; how: string },
  ) => {
    // logIn() regenerates the session: a pending 2FA state cannot leak into it.
    req.logIn(user, async (loginErr) => {
      if (loginErr) return next(loginErr);
      try {
        stampSession(req);
        if (opts.mustEnrol) req.session.mfaSetupRequired = true;
        // Getting in clears the escalation: the account is demonstrably
        // theirs, so a previous bad run should not shorten the next one.
        if (account && (account.failedAttempts > 0 || account.lockLevel > 0)) {
          await storage.setLockState(account.id, registerSuccess());
        }
        void audit(req, "login", "auth", user.id, `${user.fullName} tizimga kirdi${opts.how}`);
        const body: SessionUser = { ...user, mfaSetupRequired: opts.mustEnrol || undefined };
        res.json(body);
      } catch (err) {
        next(err);
      }
    });
  };

  /**
   * Signing in, with the escalating account lockout in front of it.
   *
   * The lock is enforced here and nowhere else. An account that locks while
   * one of its sessions is open keeps that session: the point is to stop
   * someone guessing their way in, not to throw the registrar off the counter
   * halfway through a shift. requireAuth therefore never consults it.
   */
  app.post("/api/login", loginRateLimit, (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: fromZodError(parsed.error).toString() });
    }

    handle(async (request, response) => {
      const account = await storage.getUserByUsername(parsed.data.username);

      // Locked accounts are turned away before the password is even checked,
      // so a correct guess during a lock reveals nothing and resets nothing.
      if (account) {
        const remaining = lockRemainingMs(account.lockedUntil);
        if (remaining > 0) {
          return response.status(423).json({
            message: lockMessage(remaining, isFinalLock(account)),
            lockedUntil: account.lockedUntil,
          });
        }
      }

      passport.authenticate(
        "local",
        async (err: Error | null, user: SessionUser | false, info?: { message?: string }) => {
          if (err) return next(err);

          if (!user) {
            recordFailedLogin(request);

            // No account by that name: answer exactly as for a wrong password,
            // so the form cannot be used to find out who works here.
            if (!account) {
              return response
                .status(401)
                .json({ message: info?.message ?? "Login yoki parol noto'g'ri" });
            }

            // A disabled account fails authentication too; counting that as a
            // password guess would lock a row an admin deliberately parked.
            if (!account.isActive) {
              return response
                .status(401)
                .json({ message: info?.message ?? "Login yoki parol noto'g'ri" });
            }

            const decision = registerFailure(account);
            await storage.setLockState(account.id, decision);

            if (decision.justLocked) {
              await audit(
                request,
                "login",
                "auth",
                account.id,
                `${account.fullName} hisobi qulflandi (${formatLockRemaining(decision.lockedForMs ?? 0)})`,
              );
              return response.status(423).json({
                message: lockMessage(decision.lockedForMs ?? 0, isFinalLock(decision)),
                lockedUntil: decision.lockedUntil,
              });
            }

            // Past the first lock a single mistake re-locks, so there is only
            // ever one attempt left however the count reads.
            const left =
              decision.lockLevel > 0 ? 1 : ATTEMPTS_BEFORE_LOCK - decision.failedAttempts;
            return response.status(401).json({
              message: info?.message ?? "Login yoki parol noto'g'ri",
              warning: attemptsLeftMessage(left, decision.lockLevel),
              attemptsLeft: left,
            });
          }

          try {
            // The password was right; the in-memory per-IP counter has done its job.
            clearFailedLogins(request);

            // Second factor (B1.8): the password alone does not sign in. The
            // lock escalation is left as it is until the code is right too.
            if (await storage.getUserMfa(user.id)) {
              request.session.mfaPending = { userId: user.id, at: Date.now(), attempts: 0 };
              const challenge: MfaChallenge = { mfaRequired: true, fullName: user.fullName };
              return request.session.save((saveErr) => (saveErr ? next(saveErr) : response.json(challenge)));
            }

            completeLogin(request, response, next, user, account, {
              mustEnrol: await mfaRequiredFor(user.role),
              how: "",
            });
          } catch (e) {
            next(e);
          }
        },
      )(request, response, next);
    })(req, res, next);
  });

  /**
   * Second step of a 2FA sign-in: the six digits from the authenticator app,
   * or one of the recovery codes.
   *
   * Wrong codes count against the same escalating lock as wrong passwords —
   * whoever is here already knows the password, so the code is the last thing
   * standing and must not be guessable at leisure. The pending state also
   * dies after a few minutes or a few misses, sending them back to the
   * password.
   */
  app.post("/api/login/mfa", (req, res, next) => {
    handle(async (request, response) => {
      const { code } = mfaCodeSchema.parse(request.body);
      const pending = request.session.mfaPending;
      const restart = (message: string) => {
        delete request.session.mfaPending;
        return response.status(401).json({ message, code: "MFA_EXPIRED" });
      };

      if (!pending || Date.now() - pending.at > MFA_PENDING_TTL_MS) {
        return restart("Kirish muddati tugadi. Login va parolni qaytadan kiriting");
      }

      const account = await storage.getUser(pending.userId);
      if (!account || !account.isActive) return restart("Login yoki parol noto'g'ri");

      const remaining = lockRemainingMs(account.lockedUntil);
      if (remaining > 0) {
        delete request.session.mfaPending;
        return response.status(423).json({
          message: lockMessage(remaining, isFinalLock(account)),
          lockedUntil: account.lockedUntil,
        });
      }

      // Reset by an administrator while this sign-in was half-way through.
      const record = await storage.getUserMfa(account.id);
      if (!record) return restart("Kirish muddati tugadi. Login va parolni qaytadan kiriting");

      const result = await verifyAndConsume(record, code);
      if (result === "unreadable") {
        console.error(
          `[mfa] ${account.username}: secret cannot be decrypted (MFA_ENCRYPTION_KEY / SESSION_SECRET changed?)`,
        );
        delete request.session.mfaPending;
        return response.status(500).json({
          message: "Ikki bosqichli kirish kalitini o'qib bo'lmadi. Administrator 2FA ni qayta o'rnatishi kerak",
        });
      }

      if (result === "invalid") {
        const decision = registerFailure(account);
        await storage.setLockState(account.id, decision);

        if (decision.justLocked) {
          delete request.session.mfaPending;
          await audit(
            request,
            "login",
            "auth",
            account.id,
            `${account.fullName} hisobi qulflandi — noto'g'ri 2FA kodi (${formatLockRemaining(decision.lockedForMs ?? 0)})`,
          );
          return response.status(423).json({
            message: lockMessage(decision.lockedForMs ?? 0, isFinalLock(decision)),
            lockedUntil: decision.lockedUntil,
          });
        }

        pending.attempts += 1;
        if (pending.attempts >= MFA_MAX_ATTEMPTS) {
          return restart("Juda ko'p noto'g'ri kod. Login va parolni qaytadan kiriting");
        }
        const left = decision.lockLevel > 0 ? 1 : ATTEMPTS_BEFORE_LOCK - decision.failedAttempts;
        return response.status(401).json({
          message: "Kod noto'g'ri yoki eskirgan",
          warning: attemptsLeftMessage(left, decision.lockLevel),
          attemptsLeft: left,
        });
      }

      const { password: _password, ...pub } = account;
      const user = await toSessionUser(pub);
      const how =
        result === "recovery"
          ? ` (zaxira kod bilan; ${Math.max(0, record.recoveryCodes.length - 1)} ta qoldi)`
          : " (2FA)";
      completeLogin(request, response, next, user, account, { mustEnrol: false, how });
    })(req, res, next);
  });

  /**
   * Self-service password change. Deliberately separate from the admin's
   * /api/users/:id: this one is available to every signed-in user, only ever
   * touches their own row, and requires the current password — so a walk-up to
   * an unlocked screen cannot lock the owner out of their own account.
   */
  app.post(
    "/api/user/password",
    requireAuth,
    handle(async (req, res) => {
      const input = changePasswordSchema.parse(req.body);
      const me = req.user!;

      const full = await storage.getUser(me.id);
      if (!full) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      if (!(await verifyPassword(input.currentPassword, full.password))) {
        return res.status(400).json({ message: "Joriy parol noto'g'ri" });
      }

      await storage.updateUser(me.id, { password: input.newPassword }, actorOf(req));
      // Whoever might have had the old password is signed out everywhere else.
      const ended = await revokeUserSessions(sessionStore, sessionPool, me.id, { keepSid: req.sessionID });
      await audit(
        req,
        "update",
        "user",
        me.id,
        `${me.fullName} parolini o'zgartirdi${ended ? ` (${ended} ta boshqa seans yopildi)` : ""}`,
      );
      res.json({ endedSessions: ended });
    }),
  );

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy(() => res.sendStatus(204));
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated?.()) return res.status(401).json({ message: "Avval tizimga kiring" });
    const me: SessionUser = { ...req.user!, mfaSetupRequired: req.session.mfaSetupRequired || undefined };
    res.json(me);
  });

  // ---------------------------------------------------- two-factor (B1.8)

  app.get(
    "/api/user/mfa",
    requireAuth,
    handle(async (req, res) => {
      res.json(await mfaStatusOf(req.user!.id, req.user!.role));
    }),
  );

  /**
   * Step 1 of enrolment: a fresh secret and its QR code. The current password
   * is asked for, so someone at an unlocked screen cannot tie the account to
   * their own phone and lock the owner out. Nothing is stored until the user
   * proves the app works (/enable); until then the secret waits, encrypted,
   * on the session.
   */
  app.post(
    "/api/user/mfa/setup",
    requireAuth,
    handle(async (req, res) => {
      const { password } = mfaPasswordSchema.parse(req.body);
      const me = req.user!;
      const full = await storage.getUser(me.id);
      if (!full) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      if (!(await verifyPassword(password, full.password))) {
        return res.status(400).json({ message: "Joriy parol noto'g'ri" });
      }
      if (!(await storage.mfaAvailable())) return res.status(503).json({ message: MFA_NOT_MIGRATED });
      if (await storage.getUserMfa(me.id)) {
        return res.status(409).json({ message: "Ikki bosqichli kirish allaqachon yoqilgan" });
      }

      const secret = generateTotpSecret();
      const url = otpauthUrl(me.username, secret);
      req.session.mfaSetup = { secret: encryptSecret(secret), at: Date.now() };
      const setup: MfaSetup = {
        secret,
        otpauthUrl: url,
        qrDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M" }),
      };
      res.json(setup);
    }),
  );

  /** Step 2: the first code from the app. Returns the recovery codes — once. */
  app.post(
    "/api/user/mfa/enable",
    requireAuth,
    handle(async (req, res) => {
      const { code } = mfaCodeSchema.parse(req.body);
      const me = req.user!;
      const setup = req.session.mfaSetup;
      if (!setup || Date.now() - setup.at > MFA_SETUP_TTL_MS) {
        delete req.session.mfaSetup;
        return res.status(400).json({ message: "Sozlash muddati tugadi. Qaytadan boshlang" });
      }
      const secret = decryptSecret(setup.secret);
      const step = secret ? verifyTotp(secret, code) : null;
      if (step === null) {
        return res.status(400).json({
          message: "Kod noto'g'ri. Ilovadagi joriy kodni kiriting va telefon vaqti to'g'riligini tekshiring",
        });
      }
      if (await storage.getUserMfa(me.id)) {
        delete req.session.mfaSetup;
        return res.status(409).json({ message: "Ikki bosqichli kirish allaqachon yoqilgan" });
      }

      const { codes, hashes } = generateRecoveryCodes();
      await storage.saveUserMfa(
        { userId: me.id, secret: setup.secret, recoveryCodes: hashes, lastUsedStep: step },
        actorOf(req),
      );
      delete req.session.mfaSetup;
      delete req.session.mfaSetupRequired;

      // Other devices signed in on the password alone; they do not get to
      // skip the step everyone else now has to take.
      const ended = await revokeUserSessions(sessionStore, sessionPool, me.id, { keepSid: req.sessionID });
      await audit(
        req,
        "update",
        "user",
        me.id,
        `${me.fullName} ikki bosqichli autentifikatsiyani yoqdi${ended ? ` (${ended} ta boshqa seans yopildi)` : ""}`,
      );
      res.json({ recoveryCodes: codes, endedSessions: ended });
    }),
  );

  app.post(
    "/api/user/mfa/disable",
    requireAuth,
    handle(async (req, res) => {
      const { password, code } = mfaDisableSchema.parse(req.body);
      const me = req.user!;
      if ((await getSessionPolicy()).mfaRequiredRoles.includes(me.role)) {
        return res.status(403).json({
          message:
            "Rolingiz uchun ikki bosqichli kirish majburiy. Telefon almashgan bo'lsa, administrator 2FA ni qayta o'rnatadi",
        });
      }
      const full = await storage.getUser(me.id);
      if (!full) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      if (!(await verifyPassword(password, full.password))) {
        return res.status(400).json({ message: "Joriy parol noto'g'ri" });
      }
      const record = await storage.getUserMfa(me.id);
      if (!record) return res.status(404).json({ message: "Ikki bosqichli kirish yoqilmagan" });
      if (!codeAccepted(await verifyAndConsume(record, code))) {
        return res.status(400).json({ message: "Kod noto'g'ri yoki eskirgan" });
      }
      await storage.deleteUserMfa(me.id);
      await audit(req, "update", "user", me.id, `${me.fullName} ikki bosqichli autentifikatsiyani o'chirdi`);
      res.sendStatus(204);
    }),
  );

  /** New recovery codes; the old ones stop working. Needs a current code. */
  app.post(
    "/api/user/mfa/recovery-codes",
    requireAuth,
    handle(async (req, res) => {
      const { code } = mfaCodeSchema.parse(req.body);
      const me = req.user!;
      const record = await storage.getUserMfa(me.id);
      if (!record) return res.status(404).json({ message: "Ikki bosqichli kirish yoqilmagan" });
      if (!codeAccepted(await verifyAndConsume(record, code))) {
        return res.status(400).json({ message: "Kod noto'g'ri yoki eskirgan" });
      }
      const { codes, hashes } = generateRecoveryCodes();
      await storage.replaceRecoveryCodes(me.id, hashes, actorOf(req));
      await audit(req, "update", "user", me.id, `${me.fullName} yangi zaxira kodlar yaratdi`);
      res.json({ recoveryCodes: codes });
    }),
  );

  // -------------------------------------------------------------- patients

  app.get(
    "/api/patients",
    requirePermission("patients.read"),
    handle(async (req, res) => {
      const result = await storage.listPatients({
        search: typeof req.query.search === "string" ? req.query.search : undefined,
        limit: numberParam(req.query.limit),
        offset: numberParam(req.query.offset, 0),
      });
      res.json(result);
    }),
  );

  app.get(
    "/api/patients/:id",
    requirePermission("patients.read"),
    handle(async (req, res) => {
      const patient = await storage.getPatientDetails(req.params.id);
      if (!patient) return res.status(404).json({ message: "Bemor topilmadi" });
      res.json(patient);
    }),
  );

  const logCardView = (req: Request, patient: { id: string; patientNumber: number; fullName: string }) =>
    logPatientView(req, patient, "kartasi ochildi");

  /**
   * The patient card (TZ §4.1.3, §4.2): the person, every visit with what was
   * done, and the money. Trimmed to the viewer's role: no orders without
   * orders.read, no amounts without a finance permission.
   */
  app.get(
    "/api/patients/:id/card",
    requirePermission("patients.read"),
    handle(async (req, res) => {
      const card = await storage.getPatientCard(req.params.id);
      if (!card) return res.status(404).json({ message: "Bemor topilmadi" });
      await logCardView(req, card.patient);

      if (!hasPermission(req, "orders.read")) {
        // Lab orders are hidden; the days the patient saw a doctor stay.
        card.visits = card.visits
          .map((v) => ({ ...v, orders: [], billed: 0, paid: 0 }))
          .filter((v) => v.appointments.length > 0);
        card.payments = [];
      }
      if (!hasPermission(req, "finance.view") && !hasPermission(req, "payments.create")) {
        card.payments = [];
        card.totals = { ...card.totals, billed: null, paid: null, debt: null };
      }
      res.json(card);
    }),
  );

  /** Who opened this card, and when — for the auditor. */
  app.get(
    "/api/patients/:id/access-log",
    requirePermission("audit.read"),
    handle(async (req, res) => {
      res.json(
        await storage.listAudit({
          entity: "patient",
          entityId: req.params.id,
          limit: numberParam(req.query.limit, 100),
          offset: numberParam(req.query.offset, 0),
        }),
      );
    }),
  );

  /**
   * Graded possible duplicates of the person described (TZ §4.2). Strong
   * matches first; at most five, which is all a registrar will read.
   */
  async function findDuplicates(
    input: Partial<Pick<InsertPatient, "fullName" | "phone" | "birthDate" | "passport" | "pinfl">>,
    excludeId?: string,
  ): Promise<DuplicateCandidate[]> {
    const typed = {
      fullName: input.fullName ?? null,
      phoneDigits: input.phone ? nationalPhoneDigits(input.phone) : null,
      birthDate: input.birthDate ?? null,
      passport: input.passport ?? null,
      pinfl: input.pinfl ?? null,
    };
    const surname = (input.fullName ?? "").trim().split(/\s+/)[0] || null;
    const candidates = await storage.findPatientCandidates({
      surname,
      nameKey: nameKey(surname),
      phoneDigits: typed.phoneDigits,
      birthDate: typed.birthDate,
      passport: typed.passport,
      pinfl: typed.pinfl,
      excludeId,
    });
    const graded: DuplicateCandidate[] = [];
    for (const patient of candidates) {
      const match = compareIdentity(typed, {
        fullName: patient.fullName,
        phoneDigits: nationalPhoneDigits(patient.phone),
        birthDate: patient.birthDate,
        passport: patient.passport,
        pinfl: patient.pinfl,
      });
      if (match) graded.push({ patient, ...match });
    }
    return graded
      .sort((a, b) => Number(b.strength === "strong") - Number(a.strength === "strong") || b.reasons.length - a.reasons.length)
      .slice(0, 5);
  }

  /** The form asks while the registrar types, before anything is saved. */
  app.post(
    "/api/patients/check-duplicates",
    requirePermission("patients.create", "patients.update"),
    handle(async (req, res) => {
      const input = insertPatientSchema
        .pick({ fullName: true, phone: true, birthDate: true, passport: true, pinfl: true })
        .partial()
        .safeParse(req.body);
      // Half-typed input is normal here: check whatever parses, ignore the rest.
      const body = input.success ? input.data : {};
      const excludeId = typeof req.body?.excludeId === "string" ? req.body.excludeId : undefined;
      res.json(await findDuplicates(body, excludeId));
    }),
  );

  /** The birth date, when given, also keeps the legacy age column truthful. */
  const withAge = <T extends Partial<InsertPatient>>(input: T): T =>
    input.birthDate ? { ...input, age: ageFromBirthDate(input.birthDate) } : input;

  const duplicateResponse = (res: Response, strong: DuplicateCandidate[]) =>
    res.status(409).json({
      code: "DUPLICATE_PATIENT",
      message: `Bu bemor bazada bor bo'lishi mumkin: ${strong[0].patient.fullName} (№${strong[0].patient.patientNumber}) — ${strong[0].reasons.join(", ")}`,
      candidates: strong,
    });

  /** A patient's full visit history — the "was he here before?" question. */
  app.get(
    "/api/patients/:id/orders",
    requirePermission("orders.read"),
    handle(async (req, res) => {
      const result = await storage.listOrders({ patientId: req.params.id });
      res.json(result);
    }),
  );

  app.post(
    "/api/patients",
    requirePermission("patients.create"),
    handle(async (req, res) => {
      const input = withAge(insertPatientSchema.parse(req.body));
      if (!input.allowDuplicate) {
        const strong = (await findDuplicates(input)).filter((c) => c.strength === "strong");
        if (strong.length) return duplicateResponse(res, strong);
      }
      const patient = await storage.createPatient(input, actorOf(req));
      await audit(
        req,
        "create",
        "patient",
        patient.id,
        `№${patient.patientNumber} ${patient.fullName}${input.allowDuplicate ? " (o'xshash bemor ogohlantirishi tasdiqlangan)" : ""}`,
      );
      // If they opened the bot before their first visit, bind that chat now.
      res.status(201).json(await claimPendingContact(patient));
    }),
  );

  app.patch(
    "/api/patients/:id",
    requirePermission("patients.update"),
    handle(async (req, res) => {
      const input = withAge(insertPatientSchema.partial().parse(req.body));
      const before = await storage.getPatient(req.params.id);
      if (!before) return res.status(404).json({ message: "Bemor topilmadi" });

      // An edit is only stopped by a document collision: two cards sharing a
      // passport or JShShIR is never right, whereas a shared phone often is.
      const idChanged =
        (input.pinfl !== undefined && input.pinfl !== before.pinfl) ||
        (input.passport !== undefined && input.passport !== before.passport);
      if (idChanged && !input.allowDuplicate) {
        const clash = (await findDuplicates({ pinfl: input.pinfl, passport: input.passport }, before.id)).filter(
          (c) => c.strength === "strong",
        );
        if (clash.length) return duplicateResponse(res, clash);
      }

      const patient = await storage.updatePatient(req.params.id, input, actorOf(req));
      if (!patient) return res.status(404).json({ message: "Bemor topilmadi" });

      const changes: string[] = [];
      const fields: [keyof Patient, string][] = [
        ["fullName", "F.I.Sh"],
        ["phone", "telefon"],
        ["birthDate", "tug'ilgan sana"],
        ["gender", "jinsi"],
        ["address", "manzil"],
        ["passport", "pasport"],
        ["pinfl", "JShShIR"],
      ];
      for (const [k, label] of fields) if ((before[k] ?? null) !== (patient[k] ?? null)) changes.push(label);
      if (input.emergencyContact !== undefined) changes.push("favqulodda aloqa");
      await audit(
        req,
        "update",
        "patient",
        patient.id,
        `№${patient.patientNumber} ${patient.fullName} — ${changes.length ? changes.join(", ") + " o'zgardi" : "tahrirlandi"}`,
      );
      // A corrected phone number can match a chat that was waiting all along.
      res.json(await claimPendingContact(patient));
    }),
  );

  /**
   * Folds a duplicate card into the real one (TZ §4.2). Everything clinical
   * moves; nothing is lost. Gated like deletion because the duplicate card
   * stops existing.
   */
  app.post(
    "/api/patients/:id/merge",
    requirePermission("patients.delete"),
    handle(async (req, res) => {
      const intoId = typeof req.body?.intoId === "string" ? req.body.intoId : "";
      if (!intoId || intoId === req.params.id) {
        return res.status(400).json({ message: "Qaysi bemorga birlashtirishni tanlang" });
      }
      const [source, target] = await Promise.all([storage.getPatient(req.params.id), storage.getPatient(intoId)]);
      if (!source || !target) return res.status(404).json({ message: "Bemor topilmadi" });
      const moved = await storage.mergePatients(source.id, target.id, actorOf(req));
      if (!moved) return res.status(404).json({ message: "Bemor topilmadi" });
      await audit(
        req,
        "update",
        "patient",
        target.id,
        `№${source.patientNumber} ${source.fullName} kartasi №${target.patientNumber} ${target.fullName} bilan birlashtirildi ` +
          `(${moved.orders} ta buyurtma, ${moved.appointments} ta qabul, ${moved.contacts} ta aloqa ko'chirildi)`,
      );
      res.json({ ...moved, patient: await storage.getPatientDetails(target.id) });
    }),
  );

  app.delete(
    "/api/patients/:id",
    requirePermission("patients.delete"),
    handle(async (req, res) => {
      const before = await storage.getPatient(req.params.id);
      const ok = await storage.deletePatient(req.params.id);
      if (!ok) return res.status(404).json({ message: "Bemor topilmadi" });
      await audit(req, "delete", "patient", req.params.id, `${before?.fullName ?? "Bemor"} o'chirildi`);
      res.sendStatus(204);
    }),
  );

  // ----------------------------------------------------------------- tests

  app.get(
    "/api/tests",
    requireAuth,
    handle(async (req, res) => {
      res.json(await storage.listTests({ activeOnly: req.query.all !== "1" }));
    }),
  );

  app.post(
    "/api/tests",
    requirePermission("tests.manage"),
    handle(async (req, res) => {
      const test = await storage.createTest(insertTestSchema.parse(req.body), actorOf(req));
      await audit(req, "create", "test", test.id, `"${test.name}" qo'shildi — ${test.price} so'm`);
      res.status(201).json(test);
    }),
  );

  app.patch(
    "/api/tests/:id",
    requirePermission("tests.manage"),
    handle(async (req, res) => {
      const input = insertTestSchema.partial().parse(req.body);
      const before = await storage.getTest(req.params.id);
      const test = await storage.updateTest(req.params.id, input, actorOf(req));
      if (!test) return res.status(404).json({ message: "Tahlil topilmadi" });
      // A price change is the one edit worth spelling out — it silently
      // rewrites what every future order costs.
      const priceMoved = before && before.price !== test.price;
      await audit(
        req,
        "update",
        "test",
        test.id,
        priceMoved
          ? `"${test.name}" narxi ${before!.price} → ${test.price} so'm`
          : `"${test.name}" tahrirlandi`,
      );
      res.json(test);
    }),
  );

  app.delete(
    "/api/tests/:id",
    requirePermission("tests.manage"),
    handle(async (req, res) => {
      const before = await storage.getTest(req.params.id);
      const ok = await storage.deleteTest(req.params.id);
      if (!ok) return res.status(404).json({ message: "Tahlil topilmadi" });
      await audit(req, "delete", "test", req.params.id, `"${before?.name ?? "Tahlil"}" o'chirildi`);
      res.sendStatus(204);
    }),
  );

  // ---------------------------------------------------------------- orders

  app.get(
    "/api/orders",
    requirePermission("orders.read"),
    handle(async (req, res) => {
      const statusParam = req.query.status;
      const status = ORDER_STATUSES.find((s) => s === statusParam);
      const queueParam = req.query.queue;
      const queue = queueParam === "waiting" || queueParam === "review" || queueParam === "ready" ? queueParam : undefined;
      const result = await storage.listOrders({
        search: typeof req.query.search === "string" ? req.query.search : undefined,
        status,
        queue,
        group: isTestGroup(req.query.group) ? req.query.group : undefined,
        patientId: typeof req.query.patientId === "string" ? req.query.patientId : undefined,
        from: typeof req.query.from === "string" ? req.query.from : undefined,
        to: typeof req.query.to === "string" ? req.query.to : undefined,
        limit: numberParam(req.query.limit),
        offset: numberParam(req.query.offset, 0),
      });
      res.json(result);
    }),
  );

  app.get(
    "/api/orders/:id",
    requirePermission("orders.read"),
    handle(async (req, res) => {
      const order = await storage.getOrder(req.params.id);
      if (!order) return res.status(404).json({ message: "Buyurtma topilmadi" });
      res.json(order);
    }),
  );

  app.post(
    "/api/orders",
    requirePermission("orders.create"),
    handle(async (req, res) => {
      const input = createOrderSchema.parse(req.body);
      const order = await storage.createOrder({ ...input, createdBy: req.user?.id ?? null });
      await audit(
        req,
        "create",
        "order",
        order.id,
        `#${order.orderNumber} buyurtma yaratildi — ${order.items.length} ta tahlil`,
      );
      res.status(201).json(order);
    }),
  );

  app.patch(
    "/api/orders/:id",
    requirePermission("orders.update", "orders.cancel"),
    handle(async (req, res) => {
      const input = updateOrderSchema.parse(req.body);
      const before = await storage.getOrder(req.params.id);
      if (!before) return res.status(404).json({ message: "Buyurtma topilmadi" });

      // Cancelling (and bringing a cancelled order back) is its own grant: it
      // takes the order out of the cash and results flow, which an ordinary
      // edit must not be able to do.
      const touchesCancel =
        input.status !== undefined &&
        input.status !== before.status &&
        (input.status === "cancelled" || before.status === "cancelled");
      const editsOther =
        (input.status !== undefined && !touchesCancel && input.status !== before.status) ||
        input.testIds !== undefined ||
        input.discount !== undefined ||
        input.paidAmount !== undefined ||
        input.notes !== undefined ||
        input.referrer !== undefined;
      if (touchesCancel && !hasPermission(req, "orders.cancel")) {
        return res.status(403).json({ message: "Buyurtmani bekor qilish uchun ruxsatingiz yo'q" });
      }
      if (editsOther && !hasPermission(req, "orders.update")) {
        return res.status(403).json({ message: "Buyurtmani tahrirlash uchun ruxsatingiz yo'q" });
      }

      const order = await storage.updateOrder(req.params.id, input, actorOf(req));
      if (!order) return res.status(404).json({ message: "Buyurtma topilmadi" });

      // Spelled out rather than "order updated": the log is only worth keeping
      // if it says what actually changed.
      const changes: string[] = [];
      if (input.testIds && before.items.length !== order.items.length) {
        changes.push(`tahlillar ${before.items.length} → ${order.items.length} ta`);
      }
      if (input.discount !== undefined && before.discount !== order.discount) {
        changes.push(`chegirma ${before.discount} → ${order.discount}`);
      }
      if (input.status && before.status !== order.status) {
        changes.push(`holat ${before.status} → ${order.status}`);
      }
      if (input.referrer !== undefined && (before.referrer ?? "") !== (order.referrer ?? "")) {
        changes.push(`yo'naltirgan: ${order.referrer || "—"}`);
      }
      if (changes.length) {
        await audit(req, "update", "order", order.id, `#${order.orderNumber}: ${changes.join(", ")}`);
      }

      // Marking an order completed by hand delivers it too, not just the
      // results screen.
      if (order.status === "completed") await notifyIfReady(order);
      res.json(order);
    }),
  );

  app.post(
    "/api/orders/:id/results",
    requirePermission("results.enter"),
    handle(async (req, res) => {
      const { results } = saveResultsSchema.parse(req.body);
      const order = await storage.saveResults(req.params.id, results, actorOf(req));
      if (!order) return res.status(404).json({ message: "Buyurtma topilmadi" });
      await audit(
        req,
        "results",
        "order",
        order.id,
        `#${order.orderNumber}: ${results.length} ta natija saqlandi`,
      );
      // Awaited on purpose: a serverless instance is frozen the moment the
      // response is flushed, so a detached send would never leave the machine.
      // notifyIfReady swallows its own errors, so saving results cannot fail
      // because Telegram is down.
      const delivery = await notifyIfReady(order);
      res.json({ ...order, telegram: delivery });
    }),
  );

  // ------------------------------------------------------ notifications (B3.9)

  /** The signed-in user's own notices; nobody reads anyone else's. */
  app.get(
    "/api/notifications",
    requireAuth,
    handle(async (req, res) => {
      const limit = Math.min(50, Math.max(1, numberParam(req.query.limit, 20) ?? 20));
      res.json(await storage.listNotifications(req.user!.id, limit).catch((e) => emptyIfMissing(e, { items: [], unread: 0 })));
    }),
  );

  app.post(
    "/api/notifications/:id/read",
    requireAuth,
    handle(async (req, res) => {
      const changed = await storage.markNotificationRead(req.user!.id, req.params.id);
      res.json({ ok: true, changed });
    }),
  );

  app.post(
    "/api/notifications/read-all",
    requireAuth,
    handle(async (req, res) => {
      res.json({ ok: true, changed: await storage.markAllNotificationsRead(req.user!.id) });
    }),
  );

  // ------------------------------------------------- verification (B4.5)

  /**
   * The lab head checks entered values (TZ §6.1.5). Verifying the last open
   * line releases the order: it goes to Telegram and to the doctor.
   */
  app.post(
    "/api/orders/:id/verify",
    requirePermission("results.verify"),
    handle(async (req, res) => {
      const { itemIds } = verifyResultsSchema.parse(req.body ?? {});
      const outcome = await storage.verifyResults(req.params.id, itemIds ?? null, actorOf(req));
      if (!outcome) return res.status(404).json({ message: "Buyurtma topilmadi" });
      const { order, verified, selfChecked } = outcome;
      const released = isOrderReleased(order);
      await audit(
        req,
        "verify",
        "order",
        order.id,
        `#${order.orderNumber}: ${verified} ta natija tasdiqlandi${selfChecked ? ` (${selfChecked} tasini o'zi kiritgan)` : ""}${
          released ? " — buyurtma to'liq tasdiqlandi" : ""
        }`,
      );
      // Awaited: a serverless instance freezes once the response is sent.
      const [delivery, doctorTold] = released
        ? await Promise.all([notifyIfReady(order), notifyOrderingDoctor(order, { kind: "released" })])
        : [undefined, false];
      res.json({ ...order, telegram: delivery, doctorNotified: doctorTold });
    }),
  );

  /** Sends values back to the laborant with a reason. */
  app.post(
    "/api/orders/:id/return",
    requirePermission("results.verify"),
    handle(async (req, res) => {
      const { itemIds, reason } = returnResultsSchema.parse(req.body);
      const order = await storage.returnResults(req.params.id, itemIds, reason, actorOf(req));
      if (!order) return res.status(404).json({ message: "Buyurtma topilmadi" });
      const names = order.items.filter((i) => itemIds.includes(i.id)).map((i) => i.testName);
      await audit(req, "return", "order", order.id, `#${order.orderNumber}: qayta tekshirishga qaytarildi — ${names.join(", ")}. Sabab: ${reason}`);
      res.json(order);
    }),
  );

  /** Corrects a verified value; the replaced one is kept as a version. */
  app.post(
    "/api/orders/:id/items/:itemId/amend",
    requirePermission("results.amend"),
    handle(async (req, res) => {
      const { reason, ...input } = amendResultSchema.parse(req.body);
      const outcome = await storage.amendResult(req.params.id, req.params.itemId, input, reason, actorOf(req));
      if (!outcome) return res.status(404).json({ message: "Natija topilmadi" });
      const line = outcome.order.items.find((i) => i.id === req.params.itemId)!;
      await notifyOrderingDoctor(outcome.order, { kind: "amended", testName: line.testName, from: outcome.previous.result, to: line.result! });
      await audit(
        req,
        "amend",
        "order",
        outcome.order.id,
        `#${outcome.order.orderNumber}: "${line.testName}" tuzatildi ${outcome.previous.result ?? "—"} → ${line.result} (v${outcome.previous.version} → v${line.version}). Sabab: ${reason}`,
      );
      res.json(outcome.order);
    }),
  );

  app.get(
    "/api/orders/:id/items/:itemId/versions",
    requirePermission("orders.read"),
    handle(async (req, res) => {
      const order = await storage.getOrder(req.params.id);
      if (!order || !order.items.some((i) => i.id === req.params.itemId)) {
        return res.status(404).json({ message: "Natija topilmadi" });
      }
      res.json(await storage.listResultVersions(req.params.itemId).catch((e) => emptyIfMissing(e, [])));
    }),
  );

  /** Manual (re)send from the order card — for a fixed result or a late link. */
  app.post(
    "/api/orders/:id/telegram",
    requirePermission("results.send"),
    handle(async (req, res) => {
      const order = await storage.getOrder(req.params.id);
      if (!order) return res.status(404).json({ message: "Buyurtma topilmadi" });
      const result = await deliverOrderResults(order, { force: true });
      if (!result.sent) return res.status(400).json({ message: result.reason ?? "Yuborilmadi" });
      res.json({ ...(await storage.getOrder(req.params.id))!, telegram: result });
    }),
  );

  // ---------------------------------------------------------- result links

  /**
   * Mints (or returns) the token behind the QR code on a printed blank.
   *
   * Staff-only and idempotent: the print dialog calls it every time it opens,
   * and a reprint has to carry the same code as the sheet already in the
   * patient's hands.
   */
  /**
   * Moves the order's tube along its chain of custody.
   *
   * Open to both counter roles: the registrar draws the tube and the laborant
   * accepts or refuses it, and which of them is doing which step is recorded
   * on the row rather than enforced by the route — a small lab has one person
   * doing both, and a permission wall there would only teach them to share a
   * login.
   */
  app.patch(
    "/api/orders/:id/sample",
    requirePermission("samples.manage"),
    handle(async (req, res) => {
      const input = updateSampleSchema.parse(req.body);
      const result = await storage.updateSampleStatus(req.params.id, input, actorOf(req));

      if (!result) return res.status(404).json({ message: "Namuna topilmadi" });
      // A refused transition is a conflict, not a bad request: the body was
      // well-formed, the tube had simply moved on since the page was loaded.
      if ("error" in result) return res.status(409).json({ message: result.error });

      const { sample, order } = result;
      const detail =
        input.status === "rad_etildi"
          ? `rad etildi — ${sample.rejectReason}`
          : input.status === "qabul_qilindi" && sample.quality
            ? `${SAMPLE_STATUS_LABELS[sample.status]}, sifati: ${SAMPLE_QUALITY_LABELS[sample.quality as SampleQuality] ?? sample.quality}${sample.qualityNote ? ` (${sample.qualityNote})` : ""}`
            : SAMPLE_STATUS_LABELS[sample.status];
      await audit(req, "sample", "order", order.id, `#${order.orderNumber} namuna: ${detail}`);

      res.json(order);
    }),
  );

  /**
   * Resolves a scanned barcode to its order.
   *
   * A miss is a 404 with no detail — the scan box is behind a login, but there
   * is still no reason for it to confirm which numbers exist.
   */
  app.get(
    "/api/samples/scan",
    requirePermission("samples.manage"),
    handle(async (req, res) => {
      const code = String(req.query.code ?? "");
      const order = await storage.getOrderByBarcode(code);
      if (!order) return res.status(404).json({ message: "Bunday barcode topilmadi" });
      res.json(order);
    }),
  );

  app.delete(
    "/api/orders/:id",
    requirePermission("orders.delete"),
    handle(async (req, res) => {
      // Read before deleting: afterwards there is no order number left to log.
      const before = await storage.getOrder(req.params.id);
      const ok = await storage.deleteOrder(req.params.id);
      if (!ok) return res.status(404).json({ message: "Buyurtma topilmadi" });
      await audit(
        req,
        "delete",
        "order",
        req.params.id,
        `#${before?.orderNumber ?? "?"} buyurtma o'chirildi (${before?.patient?.fullName ?? "—"})`,
      );
      res.sendStatus(204);
    }),
  );

  // -------------------------------------------------------------- payments

  app.post(
    "/api/orders/:id/payments",
    requirePermission("payments.create", "payments.refund"),
    handle(async (req, res) => {
      const input = createPaymentSchema.parse(req.body);
      // A refund hands cash back out of the till; TZ §9.2 reserves it for an
      // authorised person, so it is checked apart from taking a payment.
      const needed: Permission = input.amount < 0 ? "payments.refund" : "payments.create";
      if (!hasPermission(req, needed)) {
        return res.status(403).json({
          message:
            needed === "payments.refund"
              ? "To'lovni qaytarish uchun ruxsatingiz yo'q"
              : "To'lov qabul qilish uchun ruxsatingiz yo'q",
        });
      }
      const order = await storage.addPayment(req.params.id, input, actorOf(req));
      if (!order) return res.status(404).json({ message: "Buyurtma topilmadi" });
      const latest = order.payments?.[0];
      await audit(
        req,
        latest && latest.amount < 0 ? "refund" : "payment",
        "order",
        order.id,
        `#${order.orderNumber}: ${latest?.amount ?? input.amount} so'm (${input.method})`,
      );
      res.status(201).json(order);
    }),
  );

  /**
   * Voids a mistyped ledger entry (TZ §10: financial records are never
   * deleted). The row stays visible, struck through, with who and why; the
   * paid total stops counting it. Money handed back is a refund, not this.
   */
  app.post(
    "/api/payments/:id/void",
    requirePermission("payments.delete"),
    handle(async (req, res) => {
      const { reason } = voidPaymentSchema.parse(req.body);
      const order = await storage.voidPayment(req.params.id, reason, actorOf(req));
      if (!order) return res.status(404).json({ message: "To'lov topilmadi" });
      const row = order.payments?.find((p) => p.id === req.params.id);
      await audit(
        req,
        "void",
        "order",
        order.id,
        `#${order.orderNumber}: ${row?.amount ?? "?"} so'm to'lov bekor qilindi. Sabab: ${reason}`,
      );
      res.json(order);
    }),
  );

  // -------------------------------------------------------------- expenses

  /** The list filters, shared by the JSON list and the CSV export. */
  const expenseQuery = (req: Request) => {
    const status = stringParam(req.query.status);
    const category = stringParam(req.query.category);
    const method = stringParam(req.query.method);
    return {
      from: stringParam(req.query.from),
      to: stringParam(req.query.to),
      category: category && (EXPENSE_CATEGORIES as readonly string[]).includes(category) ? category : undefined,
      method: method && (PAYMENT_METHODS as readonly string[]).includes(method) ? method : undefined,
      search: stringParam(req.query.search),
      status: (status === "cancelled" || status === "all" ? status : "active") as ExpenseQuery["status"],
    };
  };

  /** "1 000 000 so'm" with plain spaces — the project's money format, not the locale's. */
  const fmtSum = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;

  app.get(
    "/api/expenses",
    requirePermission("expenses.read"),
    handle(async (req, res) => {
      res.json(
        await storage.listExpenses({
          ...expenseQuery(req),
          limit: numberParam(req.query.limit),
          offset: numberParam(req.query.offset, 0),
        }),
      );
    }),
  );

  /** Whole-range figures for the dashboard: not just the page on screen. */
  app.get(
    "/api/expenses/summary",
    requirePermission("expenses.read"),
    handle(async (req, res) => {
      const from = stringParam(req.query.from);
      const to = stringParam(req.query.to);
      const day = /^\d{4}-\d{2}-\d{2}$/;
      if (!from || !to || !day.test(from) || !day.test(to) || from > to) {
        return res.status(400).json({ message: "Davrni to'g'ri tanlang" });
      }
      res.json(await storage.getExpenseSummary(from, to));
    }),
  );

  app.get(
    "/api/expenses/payees",
    requirePermission("expenses.manage"),
    handle(async (_req, res) => {
      res.json(await storage.listExpensePayees());
    }),
  );

  app.post(
    "/api/expenses",
    requirePermission("expenses.manage"),
    handle(async (req, res) => {
      const input = insertExpenseSchema.parse(req.body);
      const row = await storage.createExpense(input, actorOf(req));
      await audit(
        req,
        "create",
        "expense",
        row.id,
        `${row.category}: ${fmtSum(row.amount)}${row.payee ? ` → ${row.payee}` : ""} (${row.spentOn})`,
      );
      res.status(201).json(row);
    }),
  );

  app.patch(
    "/api/expenses/:id",
    requirePermission("expenses.manage"),
    handle(async (req, res) => {
      const input = updateExpenseSchema.parse(req.body);
      const before = await storage.getExpense(req.params.id);
      if (!before) return res.status(404).json({ message: "Xarajat topilmadi" });
      if (before.status === "cancelled") {
        return res.status(409).json({ message: "Bekor qilingan xarajatni tahrirlab bo'lmaydi" });
      }
      const row = await storage.updateExpense(req.params.id, input, actorOf(req));
      if (!row) return res.status(404).json({ message: "Xarajat topilmadi" });

      // A money record's edit history is the point of the audit log.
      const changes: string[] = [];
      if (row.amount !== before.amount) changes.push(`summa ${fmtSum(before.amount)} → ${fmtSum(row.amount)}`);
      if (row.category !== before.category) changes.push(`kategoriya ${before.category} → ${row.category}`);
      if (row.spentOn !== before.spentOn) changes.push(`sana ${before.spentOn} → ${row.spentOn}`);
      if (row.method !== before.method) changes.push(`to'lov ${before.method} → ${row.method}`);
      if ((row.payee ?? "") !== (before.payee ?? "")) changes.push(`oluvchi: ${row.payee ?? "—"}`);
      if ((row.note ?? "") !== (before.note ?? "")) changes.push("izoh o'zgardi");
      if (changes.length) {
        await audit(req, "update", "expense", row.id, `${row.category} xarajati — ${changes.join(", ")}`);
      }
      res.json(row);
    }),
  );

  /**
   * TZ §10: financial records are cancelled, never deleted. The row stays in
   * the ledger with who cancelled it and why, and drops out of every total.
   */
  app.post(
    "/api/expenses/:id/cancel",
    requirePermission("expenses.manage"),
    handle(async (req, res) => {
      const { reason } = cancelExpenseSchema.parse(req.body);
      const before = await storage.getExpense(req.params.id);
      if (!before) return res.status(404).json({ message: "Xarajat topilmadi" });
      if (before.status === "cancelled") {
        return res.status(409).json({ message: "Bu xarajat allaqachon bekor qilingan" });
      }
      const row = await storage.cancelExpense(req.params.id, reason, actorOf(req));
      await audit(
        req,
        "delete",
        "expense",
        req.params.id,
        `${before.category}: ${fmtSum(before.amount)} bekor qilindi — ${reason}`,
      );
      res.json(row);
    }),
  );

  // ----------------------------------------------------------------- audit

  app.get(
    "/api/audit",
    requirePermission("audit.read"),
    handle(async (req, res) => {
      res.json(
        await storage.listAudit({
          entity: stringParam(req.query.entity),
          action: stringParam(req.query.action),
          limit: numberParam(req.query.limit, 50),
          offset: numberParam(req.query.offset, 0),
        }),
      );
    }),
  );

  // ----------------------------------------------------------------- export

  /**
   * Server-side so the file covers the whole dataset, not the page the user
   * happens to be looking at — the reason to export at all is usually to hand
   * the *complete* list to an accountant.
   */
  app.get(
    "/api/export/patients.csv",
    requirePermission("data.export"),
    handle(async (req, res) => {
      const { items } = await storage.listPatients({ search: stringParam(req.query.search) });
      csvHeaders(res, `bemorlar-${stamp()}.csv`);
      res.send(
        toCsv(
          [
            "№",
            "F.I.Sh",
            "Telefon",
            "Tug'ilgan sana",
            "Yosh",
            "Jinsi",
            "Manzil",
            "Pasport",
            "JShShIR",
            "Tashriflar",
            "Oxirgi tashrif",
            "Telegram",
            "Ro'yxatdan o'tgan",
          ],
          items.map((p) => [
            p.patientNumber,
            p.fullName,
            p.phone,
            p.birthDate ?? "",
            patientAge(p) ?? "",
            p.gender ?? "",
            p.address ?? "",
            p.passport ?? "",
            p.pinfl ?? "",
            p.visitCount,
            p.lastVisitAt ? localDay(p.lastVisitAt) : "",
            p.telegramChatId ? "ha" : "yo'q",
            localDay(p.createdAt),
          ]),
        ),
      );
    }),
  );

  app.get(
    "/api/export/orders.csv",
    requirePermission("data.export"),
    handle(async (req, res) => {
      const { items } = await storage.listOrders({
        from: stringParam(req.query.from),
        to: stringParam(req.query.to),
        search: stringParam(req.query.search),
      });
      csvHeaders(res, `buyurtmalar-${stamp()}.csv`);
      res.send(
        toCsv(
          [
            "Buyurtma №",
            "Sana",
            "Bemor №",
            "Bemor",
            "Telefon",
            "Tahlillar",
            "Tahlil soni",
            "Jami",
            "Chegirma",
            "To'langan",
            "Qarz",
            "Holat",
            "Yo'naltirgan",
          ],
          items.map((o) => [
            o.orderNumber,
            localDay(o.createdAt),
            o.patient?.patientNumber ?? "",
            o.patient?.fullName ?? "",
            o.patient?.phone ?? "",
            o.items.map((i) => i.testName).join("; "),
            o.items.length,
            o.totalAmount,
            o.discount,
            o.paidAmount,
            Math.max(0, o.totalAmount - o.paidAmount),
            ORDER_STATUS_LABELS[o.status],
            o.referrer ?? "",
          ]),
        ),
      );
    }),
  );

  app.get(
    "/api/export/expenses.csv",
    requirePermission("data.export"),
    handle(async (req, res) => {
      const { items } = await storage.listExpenses(expenseQuery(req));
      csvHeaders(res, `xarajatlar-${stamp()}.csv`);
      res.send(
        toCsv(
          ["Sana", "Kategoriya", "Summa", "To'lov usuli", "Oluvchi", "Izoh", "Kim kiritdi", "Holat", "Bekor qilish sababi"],
          items.map((e) => [
            e.spentOn,
            e.category,
            e.amount,
            e.method,
            e.payee ?? "",
            e.note ?? "",
            e.createdByName ?? "",
            e.status === "cancelled" ? "Bekor qilingan" : "Faol",
            e.cancelReason ?? "",
          ]),
        ),
      );
    }),
  );

  /**
   * Full JSON snapshot. Restoring is deliberately *not* an endpoint — a
   * "replace the whole database" button reachable from a browser session is a
   * foot-gun no amount of confirmation dialog makes safe. Restore runs from the
   * CLI instead: `npm run db:restore -- <file> --yes`.
   */
  app.get(
    "/api/backup",
    requirePermission("backup.download"),
    handle(async (req, res) => {
      const [patientsAll, ordersAll, testsAll, usersAll, expensesAll, settings] = await Promise.all([
        storage.listPatients(),
        storage.listOrders(),
        storage.listTests(),
        storage.listUsers(),
        storage.listExpenses(),
        storage.getSettings(),
      ]);

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="medlab-backup-${stamp()}.json"`);
      res.setHeader("Cache-Control", "no-store");
      await audit(req, "export", "backup", null, "To'liq zaxira nusxa yuklandi");
      res.send(
        JSON.stringify(
          {
            version: 2,
            exportedAt: new Date().toISOString(),
            settings,
            // Passwords are hashes, but they are still credentials — a backup
            // file gets emailed around, so they do not travel with it.
            users: usersAll.map(({ ...u }) => u),
            tests: testsAll,
            patients: patientsAll.items,
            orders: ordersAll.items,
            expenses: expensesAll.items,
          },
          null,
          2,
        ),
      );
    }),
  );

  // ------------------------------------------------------------ reporting

  app.get(
    "/api/stats",
    requireAuth,
    handle(async (req, res) => {
      const stats = await storage.getDashboardStats();
      // Counts are everyone's business; the till is not.
      if (!hasPermission(req, "finance.view")) {
        return res.json({ ...stats, todayRevenue: null, unpaidAmount: null });
      }
      res.json(stats);
    }),
  );

  app.get(
    "/api/reports/revenue",
    requirePermission("reports.view"),
    handle(async (req, res) => {
      const today = localDay(new Date());
      const defaultFrom = new Date();
      defaultFrom.setDate(defaultFrom.getDate() - 29);
      const from = typeof req.query.from === "string" ? req.query.from : localDay(defaultFrom);
      const to = typeof req.query.to === "string" ? req.query.to : today;
      res.json(await storage.getRevenueReport(from, to));
    }),
  );

  // -------------------------------------------------------------- settings

  app.get(
    "/api/settings",
    requireAuth,
    handle(async (_req, res) => {
      res.json(await storage.getSettings());
    }),
  );

  // B4.7: the clinic's logo for blanks and documents (shared/branding.ts).
  // Served apart from /api/settings so that small, often-read object does not
  // carry an image.
  app.get(
    "/api/settings/logo",
    requireAuth,
    handle(async (_req, res) => {
      res.json(await storage.getLogo());
    }),
  );

  app.put(
    "/api/settings/logo",
    requirePermission("settings.manage"),
    handle(async (req, res) => {
      const dataUrl = req.body?.dataUrl;
      const checked = checkLogo(dataUrl);
      if (!checked.ok) return res.status(400).json({ message: checked.message });
      const logo: ClinicLogo = {
        dataUrl,
        mime: checked.mime,
        bytes: checked.bytes,
        updatedAt: new Date().toISOString(),
        updatedByName: req.user!.fullName,
      };
      await storage.setLogo(logo, actorOf(req));
      await audit(req, "update", "settings", "logo", `Klinika logotipi yangilandi (${checked.mime.replace("image/", "").toUpperCase()}, ${Math.max(1, Math.round(checked.bytes / 1024))} KB)`);
      res.json(logo);
    }),
  );

  app.delete(
    "/api/settings/logo",
    requirePermission("settings.manage"),
    handle(async (req, res) => {
      const had = await storage.getLogo();
      if (!had) return res.status(404).json({ message: "Logotip o'rnatilmagan" });
      await storage.setLogo(null, actorOf(req));
      await audit(req, "delete", "settings", "logo", "Klinika logotipi olib tashlandi");
      res.status(204).end();
    }),
  );

  app.put(
    "/api/settings",
    requirePermission("settings.manage"),
    handle(async (req, res) => {
      const saved = await storage.updateSettings(labSettingsSchema.parse(req.body));
      await audit(req, "update", "settings", "default", "Laboratoriya ma'lumotlari yangilandi");
      res.json(saved);
    }),
  );

  // ----------------------------------------------------------------- users

  /**
   * Guards shared by every staff-management route.
   *
   * Holding users.manage must not be a back door to more power than one
   * already has. So a manager can only hand out a role whose permissions they
   * hold themselves, only a super administrator can create or touch another
   * super administrator, and the system will not let the last active super
   * administrator be demoted, disabled or deleted — that would leave nobody
   * able to repair the setup.
   */
  const denied = (res: Response, message: string) => res.status(403).json({ message });

  const isSuperRole = (role: string) => role === SUPER_ADMIN || role === LEGACY_ADMIN;

  async function checkAssignableRole(req: Request, res: Response, requested: string): Promise<boolean> {
    const roleKey = requested === LEGACY_ADMIN ? SUPER_ADMIN : requested;
    const role = await storage.getRole(roleKey).catch(() => undefined);
    if (!role && !SYSTEM_ROLE_KEYS.includes(roleKey)) {
      res.status(400).json({ message: "Bunday rol mavjud emas" });
      return false;
    }
    if (roleKey === SUPER_ADMIN) {
      if (!isSuperAdmin(req)) {
        denied(res, "Super administrator rolini faqat super administrator bera oladi");
        return false;
      }
      return true;
    }
    const granted = (await toSessionUser({ ...(req.user as PublicUser), role: roleKey })).permissions;
    const missing = granted.filter((p) => !hasPermission(req, p));
    if (missing.length) {
      denied(
        res,
        `Bu rolda sizda yo'q ruxsatlar bor (${missing.map((p) => PERMISSIONS[p].label).join(", ")}). ` +
          "Uni faqat yuqoriroq vakolatli xodim bera oladi.",
      );
      return false;
    }
    return true;
  }

  async function activeSuperAdminCount(): Promise<number> {
    return (await storage.listUsers()).filter((u) => u.isActive && isSuperRole(u.role)).length;
  }

  app.get(
    "/api/users",
    requirePermission("users.manage"),
    handle(async (_req, res) => {
      res.json(await storage.listUsers());
    }),
  );

  app.post(
    "/api/users",
    requirePermission("users.manage"),
    handle(async (req, res) => {
      const input = insertUserSchema.parse(req.body);
      if (!(await checkAssignableRole(req, res, input.role))) return;
      if (await storage.getUserByUsername(input.username)) {
        return res.status(409).json({ message: "Bu login allaqachon band" });
      }
      const user = await storage.createUser(input, actorOf(req));
      const { roleName } = await toSessionUser(user);
      await audit(req, "create", "user", user.id, `${user.fullName} (${roleName}) qo'shildi`);
      res.status(201).json(user);
    }),
  );

  app.patch(
    "/api/users/:id",
    requirePermission("users.manage"),
    handle(async (req, res) => {
      const input = updateUserSchema.parse(req.body);
      const target = await storage.getUser(req.params.id);
      if (!target) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });

      if (isSuperRole(target.role) && !isSuperAdmin(req)) {
        return denied(res, "Super administrator hisobini faqat super administrator o'zgartira oladi");
      }

      const nextRole = input.role;
      const roleChanges = nextRole !== undefined && nextRole !== target.role;
      const deactivates = input.isActive === false && target.isActive;
      const isSelf = target.id === req.user?.id;

      if (isSelf && roleChanges) {
        return res.status(400).json({ message: "O'z rolingizni o'zgartira olmaysiz" });
      }
      if (isSelf && deactivates) {
        return res.status(400).json({ message: "O'z hisobingizni bloklay olmaysiz" });
      }
      if (roleChanges && !(await checkAssignableRole(req, res, nextRole))) return;

      const losesSuper = deactivates || (roleChanges && !isSuperRole(nextRole));
      if (isSuperRole(target.role) && target.isActive && losesSuper && (await activeSuperAdminCount()) <= 1) {
        return res.status(400).json({
          message: "Tizimda kamida bitta faol super administrator qolishi kerak",
        });
      }

      if (input.username) {
        const existing = await storage.getUserByUsername(input.username);
        if (existing && existing.id !== req.params.id) {
          return res.status(409).json({ message: "Bu login allaqachon band" });
        }
      }
      const user = await storage.updateUser(req.params.id, input, actorOf(req));
      forgetSessionUser(req.params.id);
      if (!user) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });

      // A reset password or a blocked account must not leave the old
      // sessions running — that is usually the very reason for the change.
      if (input.password || deactivates) {
        await revokeUserSessions(sessionStore, sessionPool, user.id, isSelf ? { keepSid: req.sessionID } : {});
      }

      // Spelled out so the log answers "who gave this person that access".
      const changes: string[] = [];
      if (roleChanges) {
        const [from, to] = await Promise.all([
          toSessionUser({ ...user, role: target.role }),
          toSessionUser(user),
        ]);
        changes.push(`rol: ${from.roleName} → ${to.roleName}`);
      }
      if (input.isActive !== undefined && input.isActive !== target.isActive) {
        changes.push(input.isActive ? "faollashtirildi" : "bloklandi");
      }
      if (input.password) changes.push("paroli almashtirildi");
      if (input.fullName && input.fullName !== target.fullName) changes.push("F.I.Sh o'zgardi");
      if (input.username && input.username !== target.username) changes.push(`login: @${input.username}`);
      await audit(
        req,
        "update",
        "user",
        user.id,
        `${user.fullName} — ${changes.length ? changes.join(", ") : "ma'lumotlari yangilandi"}`,
      );
      res.json(user);
    }),
  );

  /**
   * Clears an account's lockout.
   *
   * The escape hatch the escalation needs: without it, a laborant who mistypes
   * their password four times takes the results workflow offline for a week,
   * and a single locked administrator would strand the whole lab.
   */
  app.post(
    "/api/users/:id/unlock",
    requirePermission("users.manage"),
    handle(async (req, res) => {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });

      await storage.setLockState(user.id, registerSuccess());
      await audit(req, "update", "user", user.id, `${user.fullName} — hisob qulfi ochildi`);

      const { password: _password, ...pub } = user;
      res.json({ ...pub, failedAttempts: 0, lockedUntil: null, lockLevel: 0 });
    }),
  );

  app.delete(
    "/api/users/:id",
    requirePermission("users.manage"),
    handle(async (req, res) => {
      if (req.params.id === req.user?.id) {
        return res.status(400).json({ message: "O'z hisobingizni o'chira olmaysiz" });
      }
      const before = await storage.getUser(req.params.id);
      if (!before) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      if (isSuperRole(before.role)) {
        if (!isSuperAdmin(req)) {
          return denied(res, "Super administrator hisobini faqat super administrator o'chira oladi");
        }
        if (before.isActive && (await activeSuperAdminCount()) <= 1) {
          return res.status(400).json({
            message: "Tizimda kamida bitta faol super administrator qolishi kerak",
          });
        }
      }
      // A doctor profile means nothing without its account.
      const profile = await storage.getDoctorByUser(req.params.id).catch(() => undefined);
      if (profile) await storage.deleteDoctor(profile.id);
      const ok = await storage.deleteUser(req.params.id);
      forgetSessionUser(req.params.id);
      if (!ok) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      await audit(req, "delete", "user", req.params.id, `${before.fullName} o'chirildi`);
      res.sendStatus(204);
    }),
  );

  // ----------------------------------------------------------------- roles

  /**
   * A readable, stable key for a new role: "UZI shifokori" → "uzi_shifokori".
   * Never one of the system keys or the legacy "admin", and never reused.
   */
  async function newRoleKey(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[‘’ʻʼ']/g, "")
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40) || "rol";
    const taken = new Set([
      ...(await storage.listRoles()).map((r) => r.key),
      ...SYSTEM_ROLE_KEYS,
      LEGACY_ADMIN,
    ]);
    let key = base;
    for (let i = 2; taken.has(key); i++) key = `${base}_${i}`;
    return key;
  }

  /**
   * Permissions the editor would be granting without holding them. Only newly
   * added ones count: a role editor may still trim a role that already holds
   * something they lack.
   */
  const beyondOwn = (req: Request, next: readonly Permission[], prev: readonly Permission[] = []) =>
    isSuperAdmin(req) ? [] : next.filter((p) => !prev.includes(p) && !hasPermission(req, p));

  const labelList = (list: readonly Permission[]) =>
    list.map((p) => `${PERMISSION_GROUP_LABEL[PERMISSIONS[p].group]}: ${PERMISSIONS[p].label}`).join(", ");

  app.get(
    "/api/roles",
    // settings.manage: the 2FA policy is set per role.
    requirePermission("users.manage", "roles.manage", "settings.manage"),
    handle(async (_req, res) => {
      res.json(await storage.listRoles());
    }),
  );

  app.post(
    "/api/roles",
    requirePermission("roles.manage"),
    handle(async (req, res) => {
      const input = insertRoleSchema.parse(req.body);
      const over = beyondOwn(req, input.permissions);
      if (over.length) {
        return denied(res, `O'zingizda yo'q ruxsatlarni bera olmaysiz: ${labelList(over)}`);
      }
      const role = await storage.createRole({ ...input, key: await newRoleKey(input.name) }, actorOf(req));
      invalidateRoles();
      await audit(
        req,
        "create",
        "role",
        role.key,
        `"${role.name}" roli yaratildi (${role.permissions.length} ta ruxsat)`,
      );
      res.status(201).json({ ...role, userCount: 0 });
    }),
  );

  app.patch(
    "/api/roles/:key",
    requirePermission("roles.manage"),
    handle(async (req, res) => {
      if (req.params.key === SUPER_ADMIN) {
        return res.status(400).json({ message: "Super administrator rolini o'zgartirib bo'lmaydi" });
      }
      const input = updateRoleSchema.parse(req.body);
      const before = await storage.getRole(req.params.key);
      if (!before) return res.status(404).json({ message: "Rol topilmadi" });

      if (input.permissions) {
        const over = beyondOwn(req, input.permissions, before.permissions);
        if (over.length) {
          return denied(res, `O'zingizda yo'q ruxsatlarni bera olmaysiz: ${labelList(over)}`);
        }
      }

      const role = await storage.updateRole(req.params.key, input, actorOf(req));
      if (!role) return res.status(404).json({ message: "Rol topilmadi" });
      invalidateRoles();

      const changes: string[] = [];
      if (input.name !== undefined && input.name !== before.name) changes.push(`nomi "${input.name}"`);
      if (input.permissions) {
        const added = role.permissions.filter((p) => !before.permissions.includes(p));
        const removed = before.permissions.filter((p) => !role.permissions.includes(p));
        if (added.length) changes.push(`qo'shildi: ${labelList(added)}`);
        if (removed.length) changes.push(`olib tashlandi: ${labelList(removed)}`);
      }
      if (changes.length) {
        await audit(req, "update", "role", role.key, `"${role.name}" roli — ${changes.join("; ")}`);
      }
      const userCount = (await storage.listRoles()).find((r) => r.key === role.key)?.userCount ?? 0;
      res.json({ ...role, userCount });
    }),
  );

  app.delete(
    "/api/roles/:key",
    requirePermission("roles.manage"),
    handle(async (req, res) => {
      const role = (await storage.listRoles()).find((r) => r.key === req.params.key);
      if (!role) return res.status(404).json({ message: "Rol topilmadi" });
      if (role.isSystem) {
        return res.status(400).json({ message: "TZ'dagi tizim rollarini o'chirib bo'lmaydi" });
      }
      if (role.userCount > 0) {
        return res.status(409).json({
          message: `Bu rolda ${role.userCount} ta xodim bor. Avval ularga boshqa rol bering.`,
        });
      }
      await storage.deleteRole(role.key);
      invalidateRoles();
      await audit(req, "delete", "role", role.key, `"${role.name}" roli o'chirildi`);
      res.sendStatus(204);
    }),
  );

  // ------------------------------------------------------------- sessions

  /** The limits the client needs for its idle warning. */
  app.get(
    "/api/session/policy",
    requireAuth,
    handle(async (_req, res) => {
      res.json(await getSessionPolicy());
    }),
  );

  /**
   * "Still here." The client sends it while the user is active but has not
   * otherwise talked to the server — typing a long form, reading results — so
   * the idle limit counts real inactivity, not quiet screens.
   * enforceSessionPolicy() has already refreshed lastSeen by the time it lands.
   */
  app.post("/api/session/ping", requireAuth, (_req, res) => res.sendStatus(204));

  app.get(
    "/api/sessions",
    requireAuth,
    handle(async (req, res) => {
      res.json(await listUserSessions(sessionStore, sessionPool, req.user!.id, req.sessionID));
    }),
  );

  app.delete(
    "/api/sessions/:id",
    requireAuth,
    handle(async (req, res) => {
      const mine = await listUserSessions(sessionStore, sessionPool, req.user!.id, req.sessionID);
      const target = mine.find((s) => s.id === req.params.id);
      if (!target) return res.status(404).json({ message: "Seans topilmadi" });
      if (target.current) {
        return res.status(400).json({ message: "Joriy seansni yopish uchun \"Chiqish\" tugmasidan foydalaning" });
      }
      await revokeUserSessions(sessionStore, sessionPool, req.user!.id, { onlyId: target.id });
      await audit(req, "update", "session", req.user!.id, `${req.user!.fullName} — bitta seansni yopdi (${target.ip ?? "IP noma'lum"})`);
      res.sendStatus(204);
    }),
  );

  app.post(
    "/api/sessions/revoke-others",
    requireAuth,
    handle(async (req, res) => {
      const ended = await revokeUserSessions(sessionStore, sessionPool, req.user!.id, { keepSid: req.sessionID });
      if (ended) {
        await audit(req, "update", "session", req.user!.id, `${req.user!.fullName} — boshqa ${ended} ta seansni yopdi`);
      }
      res.json({ ended });
    }),
  );

  /** Who has 2FA — the staff list's column. Never the secrets. */
  app.get(
    "/api/users/mfa",
    requirePermission("users.manage"),
    handle(async (_req, res) => {
      res.json(await storage.listMfaEnrollments());
    }),
  );

  /**
   * A lost or replaced phone: removes the member of staff's 2FA so they can
   * sign in with the password and enrol again (straight away, if their role
   * requires it). Their sessions are ended too — the phone may be in the
   * wrong hands along with an open session.
   */
  app.post(
    "/api/users/:id/mfa/reset",
    requirePermission("users.manage"),
    handle(async (req, res) => {
      const target = await storage.getUser(req.params.id);
      if (!target) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      if (target.id === req.user!.id) {
        return res.status(400).json({ message: "O'z hisobingiz uchun Sozlamalar → Xavfsizlik bo'limidan foydalaning" });
      }
      if ((target.role === SUPER_ADMIN || target.role === LEGACY_ADMIN) && !isSuperAdmin(req)) {
        return res.status(403).json({ message: "Super administrator 2FA sini faqat super administrator o'chira oladi" });
      }
      if (!(await storage.deleteUserMfa(target.id))) {
        return res.status(404).json({ message: "Bu xodimda ikki bosqichli kirish yoqilmagan" });
      }
      const ended = await revokeUserSessions(sessionStore, sessionPool, target.id);
      await audit(
        req,
        "update",
        "user",
        target.id,
        `${target.fullName} — ikki bosqichli kirish administrator tomonidan o'chirildi${ended ? ` (${ended} ta seans yopildi)` : ""}`,
      );
      res.json({ ended });
    }),
  );

  /** Signs a member of staff out everywhere — e.g. a lost phone, or a dismissal. */
  app.post(
    "/api/users/:id/sessions/revoke",
    requirePermission("users.manage"),
    handle(async (req, res) => {
      const target = await storage.getUser(req.params.id);
      if (!target) return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
      if ((target.role === SUPER_ADMIN || target.role === LEGACY_ADMIN) && !isSuperAdmin(req)) {
        return res.status(403).json({ message: "Super administrator seanslarini faqat super administrator yopa oladi" });
      }
      const self = target.id === req.user!.id;
      const ended = await revokeUserSessions(sessionStore, sessionPool, target.id, self ? { keepSid: req.sessionID } : {});
      await audit(req, "update", "session", target.id, `${target.fullName} — ${ended} ta seans majburan yopildi`);
      res.json({ ended });
    }),
  );

  app.get(
    "/api/settings/security",
    requirePermission("settings.manage"),
    handle(async (_req, res) => {
      res.json(await storage.getSecuritySettings());
    }),
  );

  app.put(
    "/api/settings/security",
    requirePermission("settings.manage"),
    handle(async (req, res) => {
      const before = await storage.getSecuritySettings();
      // A partial body changes only what it names: the session-limits panel
      // and the 2FA panel each save their own half.
      const input = securitySettingsSchema.parse({
        ...before,
        ...securitySettingsSchema.partial().parse(req.body),
      });

      const added = input.mfaRequiredRoles.filter((k) => !before.mfaRequiredRoles.includes(k));
      const removed = before.mfaRequiredRoles.filter((k) => !input.mfaRequiredRoles.includes(k));
      const roleList = await storage.listRoles();
      const roleName = new Map(roleList.map((r) => [r.key, r.name]));
      const unknown = added.filter((k) => !roleName.has(k));
      if (unknown.length) return res.status(400).json({ message: `Noma'lum rol: ${unknown.join(", ")}` });
      if (added.length && !(await storage.mfaAvailable())) return res.status(503).json({ message: MFA_NOT_MIGRATED });

      const saved = await storage.updateSecuritySettings(input, actorOf(req));
      invalidateSessionPolicy();

      const changes: string[] = [];
      if (before.sessionIdleMinutes !== saved.sessionIdleMinutes) {
        changes.push(`faolsizlik ${before.sessionIdleMinutes} → ${saved.sessionIdleMinutes} daq.`);
      }
      if (before.sessionMaxHours !== saved.sessionMaxHours) {
        changes.push(`maksimal ${before.sessionMaxHours} → ${saved.sessionMaxHours} soat`);
      }
      const names = (keys: string[]) => keys.map((k) => roleName.get(k) ?? k).join(", ");
      if (added.length) changes.push(`2FA majburiy: ${names(added)}`);
      if (removed.length) changes.push(`2FA ixtiyoriy: ${names(removed)}`);
      if (changes.length) {
        await audit(req, "update", "settings", "security", `Xavfsizlik siyosati: ${changes.join("; ")}`);
      }
      res.json(saved);
    }),
  );

  // ---------------------------------------------------------- departments

  /**
   * Lists are readable by every signed-in user: the registrar picks a doctor
   * and a department when booking, and the doctor's own screens show them.
   * Before `npm run db:clinic` has run the tables do not exist; the lists then
   * answer empty instead of failing the whole page.
   */

  app.get(
    "/api/departments",
    requireAuth,
    handle(async (_req, res) => {
      res.json(await storage.listDepartments().catch((e) => emptyIfMissing(e, [])));
    }),
  );

  /** Names are compared without case or surrounding space: "UZI" and "uzi " are one department. */
  async function departmentNameTaken(name: string, exceptId?: string): Promise<boolean> {
    const key = name.trim().toLowerCase();
    return (await storage.listDepartments()).some((d) => d.id !== exceptId && d.name.trim().toLowerCase() === key);
  }

  app.post(
    "/api/departments",
    requirePermission("departments.manage"),
    handle(async (req, res) => {
      const input = insertDepartmentSchema.parse(req.body);
      if (await departmentNameTaken(input.name)) {
        return res.status(409).json({ message: "Bunday nomli bo'lim allaqachon bor" });
      }
      const dept = await storage.createDepartment(input, actorOf(req));
      await audit(req, "create", "department", dept.id, `"${dept.name}" bo'limi qo'shildi (${DEPARTMENT_KIND_LABELS[dept.kind]})`);
      res.status(201).json({ ...dept, doctorCount: 0 });
    }),
  );

  app.patch(
    "/api/departments/:id",
    requirePermission("departments.manage"),
    handle(async (req, res) => {
      const input = updateDepartmentSchema.parse(req.body);
      const before = await storage.getDepartment(req.params.id);
      if (!before) return res.status(404).json({ message: "Bo'lim topilmadi" });
      if (input.name && (await departmentNameTaken(input.name, before.id))) {
        return res.status(409).json({ message: "Bunday nomli bo'lim allaqachon bor" });
      }
      const dept = await storage.updateDepartment(req.params.id, input, actorOf(req));
      if (!dept) return res.status(404).json({ message: "Bo'lim topilmadi" });

      const changes: string[] = [];
      if (input.name && input.name !== before.name) changes.push(`nomi: ${before.name} → ${dept.name}`);
      if (input.kind && input.kind !== before.kind) changes.push(`turi: ${DEPARTMENT_KIND_LABELS[dept.kind]}`);
      if (input.isActive !== undefined && input.isActive !== before.isActive) {
        changes.push(dept.isActive ? "qayta ochildi" : "yopildi");
      }
      await audit(req, "update", "department", dept.id, `"${dept.name}" bo'limi — ${changes.join(", ") || "tavsif yangilandi"}`);
      const doctorCount = (await storage.listDoctors({ departmentId: dept.id })).length;
      res.json({ ...dept, doctorCount });
    }),
  );

  app.delete(
    "/api/departments/:id",
    requirePermission("departments.manage"),
    handle(async (req, res) => {
      const dept = (await storage.listDepartments()).find((d) => d.id === req.params.id);
      if (!dept) return res.status(404).json({ message: "Bo'lim topilmadi" });
      // Deleting would leave doctors pointing at nothing. Closing the
      // department (isActive = false) is the way to retire one in use.
      if (dept.doctorCount > 0) {
        return res.status(409).json({
          message: `Bu bo'limda ${dept.doctorCount} ta shifokor bor. Ularni boshqa bo'limga o'tkazing yoki bo'limni yoping.`,
        });
      }
      await storage.deleteDepartment(dept.id);
      await audit(req, "delete", "department", dept.id, `"${dept.name}" bo'limi o'chirildi`);
      res.sendStatus(204);
    }),
  );

  // -------------------------------------------------------------- doctors

  app.get(
    "/api/doctors",
    requireAuth,
    handle(async (req, res) => {
      const list = await storage
        .listDoctors({
          activeOnly: req.query.active === "1",
          departmentId: stringParam(req.query.departmentId),
        })
        .catch((e) => emptyIfMissing(e, []));
      res.json(list);
    }),
  );

  /**
   * Accounts that can be given a doctor profile: active, and without one yet.
   * Served here rather than from /api/users so that managing doctors does not
   * require the right to manage every account.
   */
  app.get(
    "/api/doctors/candidates",
    requirePermission("doctors.manage"),
    handle(async (_req, res) => {
      const taken = new Set((await storage.listDoctors().catch((e) => emptyIfMissing(e, []))).map((d) => d.userId));
      const users = (await storage.listUsers())
        .filter((u) => u.isActive && !taken.has(u.id))
        // Doctors first: they are who this list is nearly always for.
        .sort((a, b) => Number(b.role === "shifokor") - Number(a.role === "shifokor") || a.fullName.localeCompare(b.fullName));
      const named = await Promise.all(users.map(async (u) => ({ id: u.id, fullName: u.fullName, role: u.role, roleName: (await toSessionUser(u)).roleName })));
      res.json(named);
    }),
  );

  async function checkDepartment(res: Response, id: string | null | undefined): Promise<boolean> {
    if (!id) return true;
    const dept = await storage.getDepartment(id);
    if (!dept) {
      res.status(400).json({ message: "Bo'lim topilmadi" });
      return false;
    }
    if (!dept.isActive) {
      res.status(400).json({ message: `"${dept.name}" bo'limi yopilgan` });
      return false;
    }
    return true;
  }

  app.post(
    "/api/doctors",
    requirePermission("doctors.manage"),
    handle(async (req, res) => {
      const input = insertDoctorSchema.parse(req.body);
      const user = await storage.getUser(input.userId);
      if (!user) return res.status(400).json({ message: "Xodim topilmadi" });
      if (await storage.getDoctorByUser(input.userId)) {
        return res.status(409).json({ message: "Bu xodimning shifokor profili allaqachon bor" });
      }
      if (!(await checkDepartment(res, input.departmentId))) return;
      const doctor = await storage.createDoctor(input, actorOf(req));
      await audit(req, "create", "doctor", doctor.id, `${doctor.fullName} — shifokor profili (${doctor.specialty})`);
      res.status(201).json(doctor);
    }),
  );

  app.patch(
    "/api/doctors/:id",
    requirePermission("doctors.manage"),
    handle(async (req, res) => {
      const input = updateDoctorSchema.parse(req.body);
      const before = await storage.getDoctor(req.params.id);
      if (!before) return res.status(404).json({ message: "Shifokor topilmadi" });
      if (input.departmentId && input.departmentId !== before.departmentId) {
        if (!(await checkDepartment(res, input.departmentId))) return;
      }
      const doctor = await storage.updateDoctor(req.params.id, input, actorOf(req));
      if (!doctor) return res.status(404).json({ message: "Shifokor topilmadi" });

      const changes: string[] = [];
      if (input.specialty && input.specialty !== before.specialty) changes.push(`mutaxassislik: ${doctor.specialty}`);
      if (input.departmentId !== undefined && doctor.departmentId !== before.departmentId) {
        changes.push(`bo'lim: ${before.departmentName ?? "—"} → ${doctor.departmentName ?? "—"}`);
      }
      if (input.room !== undefined && (input.room ?? null) !== before.room) changes.push(`kabinet: ${doctor.room ?? "—"}`);
      if (input.consultationPrice !== undefined && input.consultationPrice !== before.consultationPrice) {
        changes.push(`narx: ${before.consultationPrice} → ${doctor.consultationPrice}`);
      }
      if (input.schedule !== undefined) changes.push("ish jadvali yangilandi");
      if (input.isActive !== undefined && input.isActive !== before.isActive) {
        changes.push(doctor.isActive ? "qabul qayta ochildi" : "qabul to'xtatildi");
      }
      await audit(req, "update", "doctor", doctor.id, `${doctor.fullName} — ${changes.join(", ") || "profil yangilandi"}`);
      res.json(doctor);
    }),
  );

  app.delete(
    "/api/doctors/:id",
    requirePermission("doctors.manage"),
    handle(async (req, res) => {
      const before = await storage.getDoctor(req.params.id);
      if (!before) return res.status(404).json({ message: "Shifokor topilmadi" });
      // Appointments are medical history and point at the doctor: a doctor
      // who has seen patients is paused (isActive = false), never removed.
      if (await storage.doctorHasAppointments(before.id)) {
        return res.status(409).json({
          message: "Bu shifokorda qabullar tarixi bor. Profilni o'chirish o'rniga qabulni to'xtating (nofaol qiling)",
        });
      }
      await storage.deleteDoctor(before.id);
      await audit(req, "delete", "doctor", before.id, `${before.fullName} — shifokor profili o'chirildi`);
      res.sendStatus(204);
    }),
  );

  registerClinicRoutes(app);
  registerMedicalRoutes(app);

  // An unknown API path is a 404 in JSON, not the client app's index.html with
  // a 200 — which is what the SPA fallback further down would otherwise serve.
  app.use("/api", (req, res, next) => {
    if (res.headersSent) return next();
    res.status(404).json({ message: `Bunday API yo'q: ${req.method} ${req.originalUrl.split("?")[0]}` });
  });

  // Turn validation and storage rejections into clean Uzbek API errors before
  // they reach the generic 500 handler in index.ts.
  app.use("/api", (err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    if (err instanceof ZodError) {
      return res.status(400).json({ message: fromZodError(err).toString() });
    }
    if (err instanceof StorageConflict) {
      return res.status(409).json({ message: err.message });
    }
    // A table from a newer release that this database has not been migrated to.
    if ((err as { code?: string } | null)?.code === "42P01") {
      return res.status(503).json({
        message: "Ma'lumotlar bazasi yangilanmagan. Administrator migratsiyalarni ishga tushirishi kerak (npm run db:upgrade).",
      });
    }
    // The JSON body parser's own refusals keep their status, in Uzbek.
    const bodyError = (err as { type?: string } | null)?.type;
    if (bodyError === "entity.too.large") return res.status(413).json({ message: "So'rov hajmi juda katta" });
    if (bodyError === "entity.parse.failed") return res.status(400).json({ message: "So'rov ma'lumoti noto'g'ri (JSON)" });
    if (err instanceof Error) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  });
}
