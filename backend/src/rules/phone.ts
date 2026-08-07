export function splitPhoneNumber(phoneStr: string) {
  if (!phoneStr) return { area: "", city: "", number: "" };
  const parts = phoneStr.split("-");
  return {
    area: parts[0] || "",
    city: parts[1] || "",
    number: parts[2] || "",
  };
}

