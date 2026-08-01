export function convertGender(value: string) {
  switch (value) {
    case "male":
      return 1;

    case "female":
      return 2;

    default:
      return null;
  }
}

