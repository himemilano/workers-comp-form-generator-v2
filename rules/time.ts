export interface InjuryTime {
  injury_ampm: "AM" | "PM";
  injury_hour: number;
  injury_minute: number;
}

export function validateInjuryTime(
  ampm: string,
  hour: number,
  minute: number
): InjuryTime {
  if (ampm !== "AM" && ampm !== "PM") {
    throw new Error("AM または PM を指定してください");
  }

  if (hour < 1 || hour > 12) {
    throw new Error("時は 1～12 の範囲で入力してください");
  }

  if (minute < 0 || minute > 59) {
    throw new Error("分は 0～59 の範囲で入力してください");
  }

  return {
    injury_ampm: ampm,
    injury_hour: hour,
    injury_minute: minute
  };
}

export function getPdfTimeFields(
  ampm: "AM" | "PM",
  hour: number,
  minute: number
) {
  return {
    amChecked: ampm === "AM",
    pmChecked: ampm === "PM",
    hourText: String(hour),
    minuteText: String(minute)
  };
}

