const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

export const longDate = (iso: string) => LONG_DATE.format(new Date(iso));

const DAY_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

export const dayKey = (iso: string) => DAY_KEY.format(new Date(iso));
