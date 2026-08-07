export function normalizePhoneNumber(
  phoneNumber: string
): string {
  const cleaned = phoneNumber.replace(
    /[^0-9]/g,
    ""
  );

  if (cleaned.length < 10) {
    throw new Error(
      "電話番号が短すぎます"
    );
  }

  return cleaned;
}

export function getPhoneDigits(
  phoneNumber: string
): string[] {
  return normalizePhoneNumber(
    phoneNumber
  ).split("");
}

