export interface PersonName {
  familyName: string;
  givenName: string;
}

export function formatJapaneseName(
  familyName: string,
  givenName: string
): string {
  return `${familyName}　${givenName}`;
}

export function validateName(
  familyName: string,
  givenName: string
): PersonName {
  const family = familyName.trim();
  const given = givenName.trim();

  if (!family) {
    throw new Error("姓が入力されていません");
  }

  if (!given) {
    throw new Error("名が入力されていません");
  }

  return {
    familyName: family,
    givenName: given
  };
}

