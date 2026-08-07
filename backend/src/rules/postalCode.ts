export interface PostalCode {
  firstPart: string;
  secondPart: string;
}

export function validatePostalCode(
  postalCode: string
): PostalCode {
  const cleaned = postalCode.replace("-", "").trim();

  if (!/^\d{7}$/.test(cleaned)) {
    throw new Error(
      "郵便番号は7桁の数字で入力してください"
    );
  }

  return {
    firstPart: cleaned.slice(0, 3),
    secondPart: cleaned.slice(3)
  };
}

export function getPostalCodeDigits(
  postalCode: string
): string[] {
  const cleaned = postalCode.replace("-", "").trim();

  if (!/^\d{7}$/.test(cleaned)) {
    throw new Error(
      "郵便番号は7桁の数字で入力してください"
    );
  }

  return cleaned.split("");
}

