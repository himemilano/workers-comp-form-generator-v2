export function normalizeLaborInsuranceNumber(
  insuranceNumber: string
): string {
  const cleaned = insuranceNumber
    .replace(/[^0-9]/g, "")
    .trim();

  if (!/^\d+$/.test(cleaned)) {
    throw new Error(
      "労働保険番号は数字のみで入力してください"
    );
  }

  return cleaned;
}

export function getLaborInsuranceDigits(
  insuranceNumber: string
): string[] {
  return normalizeLaborInsuranceNumber(
    insuranceNumber
  ).split("");
}

