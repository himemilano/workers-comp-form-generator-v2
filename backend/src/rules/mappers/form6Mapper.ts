import { RawInputData, MappedFormData } from "../../types/form";
import {
  getVal,
  padGridValue,
  parsePhone,
  parseZip,
  parseFlexibleDate,
  toHalfWidth
} from "../utils/textUtils";

function cleanHospitalName(name: string): string {
  if (!name) return "";
  return name.trim().replace(/(病院|診療所|クリニック|薬局)/g, "").trim();
}

function getEraName(eraCode: string): string {
  const code = String(eraCode).trim();
  if (code === "5") return "昭和";
  if (code === "7") return "平成";
  if (code === "9") return "令和";
  return "令和";
}

function trimLeadingZero(val: string): string {
  if (!val) return "";
  return val.replace(/^0+/, "") || "0";
}

export function buildForm6Data(
  form5RawInput: RawInputData,
  form6RawInput: RawInputData
): MappedFormData[] {
  const combinedInput: RawInputData = {
    ...form5RawInput,
    ...form6RawInput
  };

  const v = (key: string) => getVal(combinedInput, key);

  const rawLaborIns = v("労働保険番号(14桁・ハイフンなし)") || v("労働保険番号");
  const full14Digits = padGridValue(rawLaborIns, 14);
  const laborInsFirst = full14Digits.slice(0, 2);
  const laborInsLast  = full14Digits.slice(2, 14);

  const pJurisdiction = v("年金証書番号(管轄局・最初の2桁)") || v("年金証書番号(管轄局)");
  const pType = v("年金証書番号(種別・3桁目)") || v("年金証書番号(種別)");
  const pNumber = v("年金証書番号(4桁目以降)") || v("年金証書番号(番号)");
  const rawPension = toHalfWidth(v("年金証書番号") || "");
  const pensionJurisdiction = pJurisdiction || rawPension.slice(0, 2);
  const pensionType         = pType || rawPension.slice(2, 3);
  const pensionNumber       = pNumber || rawPension.slice(3);

  const workerZip   = parseZip(v("本人郵便番号(例: 123-4567)") || v("本人郵便番号"));
  const workerPhone = parsePhone(v("本人電話番号(例: 090-1234-5678)") || v("本人電話番号"));
  const compZip     = parseZip(v("証明会社郵便番号(例: 604-8130)") || v("証明会社郵便番号") || v("その会社の郵便番号"));
  const compPhone   = parsePhone(v("証明会社電話番号(例: 075-221-8800)") || v("証明会社電話番号") || v("その会社の電話番号"));

  const birthRaw = toHalfWidth(v("生年月日(例: 55年5月15日→550515)") || v("生年月日") || v("Date_of_birth") || "");
  const birthEraCode = v("生年月日の和暦(昭和は5, 平成は7, 令和は9と数字のみ入力)") || v("Japanese_era") || "9";
  const birthEraName = getEraName(birthEraCode);
  const birthYearNum = birthRaw.slice(0, 2);
  const birthYear    = birthYearNum ? `${birthEraName}${birthYearNum}` : "";
  const birthMonth   = trimLeadingZero(birthRaw.slice(2, 4));
  const birthDay     = trimLeadingZero(birthRaw.slice(4, 6));

  const injuryRaw = toHalfWidth(v("負傷年月日(例: 令和8年8月29日→080829)") || v("負傷年月日") || v("Date_of_injury") || "");
  const injuryYearNum = injuryRaw.slice(0, 2);
  const injuryYear    = injuryYearNum ? `令和${injuryYearNum}` : "";
  const injuryMonth   = trimLeadingZero(injuryRaw.slice(2, 4));
  const injuryDay     = trimLeadingZero(injuryRaw.slice(4, 6));

  const fillDateYmd  = parseFlexibleDate(v("記入日(例: 令和8年8月30日)") || v("記入日"));
  const proofDateYmd = parseFlexibleDate(v("事業主証明年月日(例: 令和8年7月29日)") || v("事業主証明年月日"));

  const workerName   = v("氏名(漢字)") || v("氏名") || v("本人氏名") || v("worker_name");
  const fullAddress  = v("労働者住所") || v("住所") || v("Claimant's_address");
  const sexVal       = v("性別(男性は1、女性は3と入力)") || v("性別") || v("sex");
  const isMale       = sexVal === "1" ? "○" : "";
  const isFemale     = sexVal === "3" ? "○" : "";

  const rawTimeType   = v("負傷時刻区分(AM または PMと入力)") || v("負傷時刻区分") || v("disaster_time_type");
  const upperTimeType = rawTimeType.toUpperCase();
  const isAM          = upperTimeType.includes("AM") || rawTimeType === "午前" || rawTimeType === "○";
  const isPM          = upperTimeType.includes("PM") || rawTimeType === "午後";
  const disasterHour   = toHalfWidth(v("負傷時刻(時・数字のみ)") || v("負傷時刻(時)") || v("disaster_hour"));
  const disasterMinute = toHalfWidth(v("負傷時刻(分・数字のみ)") || v("負傷時刻(分)") || v("disaster_minute"));

  const h1DesignatedNo = v("初診病院の労災指定医番号") || v("初診病院の労災指定病院番号") || v("designated_Hospital");
  const h2DesignatedNo = v("1回目の転院先の労災指定医番号") || v("転院先の（1回目のみ）労災指定病院番号");

  const h1Name    = v("診療を受けた病院名") || v("変更前病院名") || v("Hospital_name");
  const h1Address = v("診療を受けた病院住所") || v("変更前病院住所") || v("Hospital_Address");
  const h1Zip     = parseZip(v("診療を受けた病院郵便番号") || v("Hospital_zip") || "");

  const h2Name    = v("1回目の転院先病院名") || v("変更後病院名") || v("after_Hospital");
  const h2Address = v("1回目の病院の住所") || v("変更後病院住所") || v("after_Hospital_Address");
  const h2Zip     = parseZip(v("1回目の病院の郵便番号") || v("after_Hospital_zip") || "");
  const h2Reason  = v("1回目の転院理由") || v("変更理由") || v("Reason_for_after_Hospital");

  const h3Name    = v("2回目に転院した病院") || v("2回目の転院先病院名") || v("last_Hospital");
  const h3Address = v("2回目に転院した病院の住所") || v("2回目転院先病院住所") || v("last_Hospital_Address");
  const h3Zip     = parseZip(v("2回目に転院した病院の郵便番号") || v("last_Hospital_zip") || "");
  const h3Reason  = v("2回目の転院理由") || v("2回目変更理由") || v("Reason_for_last_Hospital");

  const pensionHospName    = v("保障年金支給後の転院病院(該当のみ)") || v("pension_Hospital");
  const pensionHospAddress = v("保障年金支給後の転院病院の住所(該当のみ)") || v("pension_Hospital_Address");
  const pensionHospZip     = parseZip(v("保障年金支給後の転院病院の郵便番号") || "");

  const commonData: MappedFormData = {
    "Area_of_the_Labor_Standards_Inspection_Office": v("所轄の労基のエリア") || v("Area_of_the_Labor_Standards_Inspection_Office"),
    "Year_of_entry": fillDateYmd.year ? `令和${fillDateYmd.year}` : "",
    "Month_of_entry": trimLeadingZero(fillDateYmd.month),
    "Date_of_entry": trimLeadingZero(fillDateYmd.day),
    "zip_first": workerZip.first,
    "zip_last": workerZip.last,
    "claimant_tel_area": workerPhone.area,
    "claimant_tel_city": workerPhone.city,
    "claimant_tel_num": workerPhone.num,

    "notification_Address": fullAddress,
    "notification_Name": workerName,

    "Labor_insurance_No._first": laborInsFirst,
    "Labor_insurance_No._last": laborInsLast,
    "worker_name": workerName,
    "male": isMale,
    "female": isFemale,
    "Year_of_birth": birthYear,
    "Birth_month": birthMonth,
    "Birth_day": birthDay,
    "age": toHalfWidth(v("年齢(数字のみ)") || v("年齢")),
    "Claimant's_address": fullAddress,
    "Job_type": v("本人の職種") || v("Job_type"),

    "injury_year": injuryYear,
    "injury_month": injuryMonth,
    "injury_day": injuryDay,
    "injury_time_am": isAM ? "○" : "",
    "injury_time_pm": isPM ? "○" : "",
    "disaster_hour": disasterHour,
    "disaster_minute": disasterMinute,

    "accident_detail": v("災害の原因と発生状況") || v("accident_detail"),
    "Location_and_condition_of_the_injury": v("傷病の部位及び状態") || v("Location_and_condition_of_the_injury"),

    "Year_of_proof_of_fact": proofDateYmd.year ? `令和${proofDateYmd.year}` : "",
    "Month_of_Proof_of_Fact": trimLeadingZero(proofDateYmd.month),
    "The_day_of_proof_of_fact": trimLeadingZero(proofDateYmd.day),
    "Company_Name": v("会社名") || v("Company_Name"),
    "Company_zip_first": compZip.first,
    "Company_zip_last": compZip.last,
    "Company_tel_area": compPhone.area,
    "Company_tel_city": compPhone.city,
    "Company_tel_num": compPhone.num,
    "Company_Address": v("提出する会社住所") || v("Company_Address"),
    "Representative's_name": v("代表者氏名") || v("Representative's_name"),

    "Pension_certificate_jurisdiction": pensionJurisdiction,
    "Pension_certificate_type": pensionType,
    "Pension_certificate_number": pensionNumber,

    "pension_Hospital": pensionHospName,
    "pension_Hospital_Address": pensionHospAddress,
    "pension_Hospital_zip_first": pensionHospZip.first,
    "pension_Hospital_zip_last": pensionHospZip.last
  };

  const results: MappedFormData[] = [];

  const page1Data: MappedFormData = {
    ...commonData,
    "designated_Hospital": h1DesignatedNo,
    "Claim_Hospital_name": cleanHospitalName(h2Name),

    "Hospital_name": h1Name,
    "Hospital_Address": h1Address,
    "Hospital_zip_first": h1Zip.first,
    "Hospital_zip_last": h1Zip.last,

    "after_Hospital": h2Name,
    "after_Hospital_Address": h2Address,
    "after_Hospital_zip_first": h2Zip.first,
    "after_Hospital_zip_last": h2Zip.last,
    "Reason_for_after_Hospital": h2Reason
  };
  results.push(page1Data);

  if (h3Name) {
    const page2Data: MappedFormData = {
      ...commonData,
      "designated_Hospital": h2DesignatedNo || h1DesignatedNo,
      "Claim_Hospital_name": cleanHospitalName(h3Name),

      "Hospital_name": h2Name,
      "Hospital_Address": h2Address,
      "Hospital_zip_first": h2Zip.first,
      "Hospital_zip_last": h2Zip.last,

      "after_Hospital": h3Name,
      "after_Hospital_Address": h3Address,
      "after_Hospital_zip_first": h3Zip.first,
      "after_Hospital_zip_last": h3Zip.last,
      "Reason_for_after_Hospital": h3Reason
    };
    results.push(page2Data);
  }

  return results;
}
