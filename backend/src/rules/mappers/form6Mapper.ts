import { RawInputData, MappedFormData } from "../../types/form";
import {
  getVal,
  padGridValue,
  parsePhone,
  parseZip,
  parseFlexibleDate,
  toHalfWidth,
  wrapText
} from "../utils/textUtils";

/**
 * 病院名のクレンジング
 */
function cleanHospitalName(name: string): string {
  if (!name) return "";
  return name.trim().replace(/(病院|診療所|クリニック|薬局)/g, "").trim();
}

/**
 * 生年月日の元号変換（5:昭和, 7:平成, 9:令和）
 */
function formatBirthYear(eraCode: string, yearNum: string): string {
  if (!yearNum) return "";
  let eraStr = "";
  if (eraCode === "5") eraStr = "昭和";
  else if (eraCode === "7") eraStr = "平成";
  else if (eraCode === "9") eraStr = "令和";
  
  return eraStr ? `${eraStr}${yearNum}` : yearNum;
}

/**
 * 令和の付加
 */
function formatReiwaYear(yearNum: string): string {
  if (!yearNum) return "";
  if (yearNum.includes("令和") || yearNum.includes("昭和") || yearNum.includes("平成")) {
    return yearNum;
  }
  return `令和${yearNum}`;
}

export function buildForm6Data(
  form5RawInput: RawInputData,
  form6RawInput: RawInputData
): MappedFormData[] {
  const combinedInput: RawInputData = {
    ...form5RawInput,
    ...form6RawInput
  };

  const v = (key: string | string[]) => getVal(combinedInput, key);

  // 1. 労働保険番号
  const rawLaborIns = v("労働保険番号(14桁・ハイフンなし)") || v("労働保険番号");
  const full14Digits = padGridValue(rawLaborIns, 14);
  const laborInsFirst = full14Digits.slice(0, 2);
  const laborInsLast  = full14Digits.slice(2, 14);

  // 特別加入用労働保険番号
  const rawSpecialLaborIns = v("労働保険番号(特別加入)") || v("特別加入労働保険番号");
  const fullSpecialDigits = padGridValue(rawSpecialLaborIns, 14);

  // 2. 年金証書番号
  const pJurisdiction = v("年金証書番号(管轄局・最初の2桁)") || v("年金証書番号(管轄局)");
  const pType = v("年金証書番号(種別・3桁目)") || v("年金証書番号(種別)");
  const pNumber = v("年金証書番号(4桁目以降)") || v("年金証書番号(番号)");

  const rawPension = toHalfWidth(v("年金証書番号") || "");
  const pensionJurisdiction = pJurisdiction || rawPension.slice(0, 2);
  const pensionType         = pType || rawPension.slice(2, 3);
  const pensionNumber       = pNumber || rawPension.slice(3);

  // 3. 連絡先・住所情報
  const workerZip   = parseZip(v("本人郵便番号(例: 123-4567)") || v("本人郵便番号"));
  const workerPhone = parsePhone(v("本人電話番号(例: 090-1234-5678)") || v("本人電話番号"));
  const compZip     = parseZip(v("証明会社郵便番号(例: 604-8130)") || v("証明会社郵便番号"));
  const compPhone   = parsePhone(v("証明会社電話番号(例: 075-221-8800)") || v("証明会社電話番号"));

  // 4. 日付分解
  const birthYmd      = parseFlexibleDate(v("生年月日(例: 55年5月15日→550515)") || v("生年月日"));
  const injuryYmd     = parseFlexibleDate(v("負傷年月日(例: 令和8年8月29日→080829)") || v("負傷年月日"));
  const proofDateYmd = parseFlexibleDate(v("事業主証明年月日") || v("証明年月日"));
  const fillDateYmd   = parseFlexibleDate(v("記入日(例: 令和8年8月30日)") || v("記入日"));

  // 元号整形
  const birthEraCode = v("生年月日の和暦(昭和は5, 平成は7, 令和は9と数字のみ入力)") || v("生年月日の和暦") || "5";
  const formattedBirthYear = formatBirthYear(birthEraCode, birthYmd.year);

  const formattedFillYear = formatReiwaYear(fillDateYmd.year);
  const formattedInjuryYear = formatReiwaYear(injuryYmd.year);
  const formattedProofYear = formatReiwaYear(proofDateYmd.year);

  // 加入年月日 (入力文章をそのまま代入)
  const joiningYearStr = v(["特別加入日(例: 令和5年4月1日)", "特別加入日", "Year_of_joining", "加入年月日"]) || "";

  // 5. 本人情報
  const workerName  = v("氏名(漢字)") || v("氏名") || v("本人氏名");
  const fullAddress = v("労働者住所") || v("住所");

  const sexVal = v("性別(男性は1、女性は3と入力)") || v("性別");
  const isMale   = sexVal === "1" ? "○" : "";
  const isFemale = sexVal === "3" ? "○" : "";

  // 6. 負傷時刻
  const rawTimeType = v("負傷時刻区分(AM または PMと入力)") || v("負傷時刻区分");
  const upperTimeType = rawTimeType.toUpperCase();
  const isAM = upperTimeType.includes("AM") || rawTimeType === "午前" || rawTimeType === "○";
  const isPM = upperTimeType.includes("PM") || rawTimeType === "午後";

  const disasterHour   = toHalfWidth(v("負傷時刻(時・数字のみ)") || v("負傷時刻(時)") || v("disaster_hour"));
  const disasterMinute = toHalfWidth(v("負傷時刻(分・数字のみ)") || v("負傷時刻(分)") || v("disaster_minute"));

  // 7. 各病院情報
  const h1DesignatedNo = v("初診病院の労災指定医番号") || v("designated_Hospital");
  const h2DesignatedNo = v("1回目の転院先の労災指定医番号");

  const h1Name    = v("診療を受けた病院名") || v("変更前病院名");
  const h1Address = v("診療を受けた病院住所") || v("変更前病院住所");
  const h1Zip     = parseZip(v("診療を受けた病院郵便番号") || v("変更前病院郵便番号"));

  const h2Name    = v("1回目の転院先病院名") || v("変更後病院名");
  const h2Address = v("1回目の病院の住所") || v("変更後病院住所");
  const h2Zip     = parseZip(v("1回目の病院の郵便番号") || v("変更後病院郵便番号"));
  const h2Reason  = v("1回目の転院理由") || v("変更理由");

  const h3Name    = v("2回目の転院先病院名");
  const h3Address = v("2回目の病院の住所");
  const h3Zip     = parseZip(v("2回目の病院の郵便番号"));
  const h3Reason  = v("2回目の転院理由");

  // 8. 裏面項目（page2）
  const hasOtherEmployment = v("その他就業先の有無") || v("複数就業有無");
  const otherEmpExist = (hasOtherEmployment === "有" || hasOtherEmployment === "1") ? "○" : "";
  const otherEmpNone  = (hasOtherEmployment === "無" || hasOtherEmployment === "0") ? "○" : "";

  const commonData: MappedFormData = {
    // 表面項目
    "Area_of_the_Labor_Standards_Inspection_Office": v("管轄労働基準監督署名") || v("労働基準監督署長殿"),
    "Year_of_entry": formattedFillYear,
    "Month_of_entry": fillDateYmd.month,
    "Date_of_entry": fillDateYmd.day,
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
    "Year_of_birth": formattedBirthYear,
    "Birth_month": birthYmd.month,
    "Birth_day": birthYmd.day,
    "age": toHalfWidth(v("年齢")),
    "Claimant's_address": fullAddress,
    "Job_type": v("職種"),

    "injury_year": formattedInjuryYear,
    "injury_month": injuryYmd.month,
    "injury_day": injuryYmd.day,
    "injury_time_am": isAM ? "○" : "",
    "injury_time_pm": isPM ? "○" : "",
    "disaster_hour": disasterHour,
    "disaster_minute": disasterMinute,

    // 余計な記号を排除して単純に改行区切りでマッピング
    "accident_detail": wrapText(v("災害の原因と発生状況(詳しく)") || v("災害の原因及び発生状況"), 52),
    "Location_and_condition_of_the_injury": wrapText(v("傷病の部位及び状態") || v("傷病名"), 25),

    "Year_of_proof_of_fact": formattedProofYear,
    "Month_of_Proof_of_Fact": proofDateYmd.month,
    "The_day_of_proof_of_fact": proofDateYmd.day,
    "Company_Name": v("証明会社名"),
    "Company_zip_first": compZip.first,
    "Company_zip_last": compZip.last,
    "Company_tel_area": compPhone.area,
    "Company_tel_city": compPhone.city,
    "Company_tel_num": compPhone.num,
    "Company_Address": wrapText(v("証明会社住所"), 28),
    "Representative's_name": v("代表者職氏名"),

    "Pension_certificate_jurisdiction": pensionJurisdiction,
    "Pension_certificate_type": pensionType,
    "Pension_certificate_number": pensionNumber,

    // 裏面項目（page2）
    "other_employment_yes": otherEmpExist,
    "other_employment_no": otherEmpNone,
    "other_employment_count": v("有の場合のその数"),
    "special_joining_group_name": v("労働保険事務組合又は特別加入団体の名称"),
    "special_joining_labor_ins_no": fullSpecialDigits,
    "Year_of_joining": joiningYearStr
  };

  const results: MappedFormData[] = [];

  // 1枚目
  results.push({
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
    "Reason_for_after_Hospital": wrapText(h2Reason, 25)
  });

  // 2枚目（転院2回目がある場合）
  if (h3Name) {
    results.push({
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
      "Reason_for_after_Hospital": wrapText(h3Reason, 25)
    });
  }

  return results;
}
