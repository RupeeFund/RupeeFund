const TURNSTILE_FIELD = "cf-turnstile-response";

interface TurnstileApi {
  reset(container?: string): void;
}

function showError(err: HTMLElement | null, message: string): void {
  if (!err) return;
  err.textContent = message;
}

function resetTurnstile(doc: Document): void {
  const api = (doc.defaultView as unknown as { turnstile?: TurnstileApi } | null)?.turnstile;
  if (api === undefined) return;
  api.reset("#waitlist-turnstile");
}

async function awaitTurnstileToken(form: HTMLFormElement, timeoutMs = 20000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const token = String(new FormData(form).get(TURNSTILE_FIELD) ?? "");
    if (token.length > 0) return token;
    if (Date.now() >= deadline) return "";
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
}

export function errorForStatus(status: number): string {
  if (status === 400)
    return "We could not add you to the list. Check your name, email address and amount, then try again.";
  if (status === 429) return "We could not add you to the list yet. Wait a minute, then try again.";
  if (status === 403) return "The bot check did not pass. Reload the page, then try again.";
  return "We could not save your signup. Try again in a few minutes.";
}

export async function submitWaitlist(
  form: HTMLFormElement,
  deps: { fetchImpl: typeof fetch; navigate: (path: string) => void; tokenTimeoutMs?: number },
): Promise<void> {
  const doc = form.ownerDocument;
  const err = doc.getElementById("waitlist-error");
  const submit = doc.getElementById("waitlist-submit") as HTMLButtonElement | null;

  showError(err, "");
  const fd = new FormData(form);
  const idleLabel = submit?.textContent ?? "";
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Joining…";
  }
  try {
    const turnstileToken = await awaitTurnstileToken(form, deps.tokenTimeoutMs);
    if (turnstileToken.length === 0) {
      showError(err, "The bot check did not finish. Reload the page, then try again.");
      return;
    }
    const res = await deps.fetchImpl("/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(fd.get("name") ?? ""),
        email: String(fd.get("email") ?? ""),
        source: String(fd.get("source") ?? ""),
        company: String(fd.get("company") ?? ""),
        amount: String(fd.get("amount") ?? ""),
        amount_other: String(fd.get("amount_other") ?? ""),
        months: String(fd.get("months") ?? ""),
        question: String(fd.get("question") ?? ""),
        updates: String(fd.get("updates") ?? ""),
        is_foss_user: String(fd.get("is_foss_user") ?? ""),
        is_foss_contributor: String(fd.get("is_foss_contributor") ?? ""),
        is_student: String(fd.get("is_student") ?? ""),
        turnstileToken,
      }),
    });
    if (!res.ok) {
      resetTurnstile(doc);
      showError(err, errorForStatus(res.status));
      return;
    }
    deps.navigate("/waitlist-confirmed");
  } catch {
    resetTurnstile(doc);
    showError(err, "We could not reach the server. Check your connection, then try again.");
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.textContent = idleLabel;
    }
  }
}

export function linkOtherAmount(form: HTMLFormElement): void {
  const typed = form.querySelector('input[name="amount_other"]') as HTMLInputElement | null;
  const choice = form.querySelector(
    'input[name="amount"][value="other"]',
  ) as HTMLInputElement | null;
  if (typed === null || choice === null) return;
  const requireTyped = (): void => {
    typed.required = choice.checked;
  };
  form.addEventListener("change", requireTyped);
  typed.addEventListener("input", () => {
    if (typed.value.trim().length > 0) choice.checked = true;
    requireTyped();
  });
}

const MISSING: Readonly<Record<string, string>> = {
  name: "Enter your full name.",
  email: "Enter your email address.",
  amount: "Choose a monthly amount.",
  amount_other: "Enter an amount in rupees.",
};

function fieldError(input: HTMLInputElement): string {
  if (input.validity.valid) return "";
  if (input.validity.typeMismatch) return "Enter an email address like name@example.com.";
  return MISSING[input.name] ?? "Check this field.";
}

function showFieldErrors(form: HTMLFormElement): HTMLInputElement | undefined {
  const inputs = Array.from(
    form.querySelectorAll<HTMLInputElement>("input[required], input[aria-describedby]"),
  );
  const messages = new Map<string, string>();
  let first: HTMLInputElement | undefined;
  for (const input of inputs) {
    const id = input.getAttribute("aria-describedby") ?? "";
    const message = fieldError(input);
    if (message.length === 0) {
      input.removeAttribute("aria-invalid");
      continue;
    }
    input.setAttribute("aria-invalid", "true");
    if (!messages.has(id)) messages.set(id, message);
    first ??= input;
  }
  for (const input of inputs) {
    const id = input.getAttribute("aria-describedby") ?? "";
    const target = form.ownerDocument.getElementById(id);
    if (target) target.textContent = messages.get(id) ?? "";
  }
  return first;
}

export function guardWaitlistForm(form: HTMLFormElement, onValid: () => void): void {
  form.noValidate = true;
  const recheck = (): void => {
    if (form.querySelector('[aria-invalid="true"]')) showFieldErrors(form);
  };
  form.addEventListener("input", recheck);
  form.addEventListener("change", recheck);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const first = showFieldErrors(form);
    if (first) first.focus();
    else onValid();
  });
}

function initWaitlistForm(
  doc: Document,
  deps: { fetchImpl: typeof fetch; navigate: (path: string) => void },
): void {
  const form = doc.getElementById("waitlist-form") as HTMLFormElement | null;
  if (!form) return;
  linkOtherAmount(form);
  guardWaitlistForm(form, () => void submitWaitlist(form, deps));
}

function onReady(run: () => void): void {
  if (typeof document === "undefined") return;
  if (document.readyState !== "loading") run();
  else document.addEventListener("DOMContentLoaded", run);
}

export function initSubscribePage(): void {
  onReady(() => {
    initWaitlistForm(document, {
      fetchImpl: window.fetch.bind(window),
      navigate: (path) => window.location.assign(path),
    });
  });
}
