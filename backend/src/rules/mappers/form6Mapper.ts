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

function formatBirthYear(eraCode: string, yearNum: string): string {
  if (!yearNum) return "";
  let eraStr = "";
  if (eraCode === "5") eraStr = "昭和";
  else if (eraCode === "7") eraStr = "平成";
  else if (eraCode === "9") eraStr = "令和";
  
  return eraStr ? `${eraStr}${yearNum}` : yearNum;
}

function formatReiwaYear(yearNum: string): string {
  if (!yearNum) return "";
  if (yearNum.includes("令和") || yearNum.includes("昭和") || yearNum.includes("平成")) {
    return yearNum;
  }
  return `令和${yearNum}`;
}

function parseJoiningDate(dateStr: string): { year: string; month: string; day: string } {
  if (!dateStr) return { year: "", month: "", day: "" };

  const kanjiMatch = dateStr.match(/^(明治|大正|昭和|平成|令和)?\s*(\d{1,2}|元)年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (kanjiMatch) {
    const era = kanjiMatch[1] || "";
    const y = kanjiMatch[2];
    const m = kanjiMatch[3];
    const d = kanjiMatch[4];
    return {
      year: era ? `${era}${y}` : y,
      month: m,
      day: d
    };
  }

  const flex = parseFlexibleDate(dateStr);
  if (flex.year || flex.month || flex.day) {
    return {
      year: flex.year ? `令和${flex.year}` : "",
      month: flex.month,
      day: flex.day
    };
  }

  return { year: dateStr, month: "", day: "" };
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
  const rawLaborIns = v(["労働保険番号(14桁・ハイフンなし)", "労働保険番号"]);
  const full14Digits = padGridValue(rawLaborIns, 14);
  const laborInsFirst = full14Digits.slice(0, 2);
  const laborInsLast  = full14Digits.slice(2, 14);

  // 特別加入用労働保険番号（★入力サンプルキー「特別加入の労働保険番号」に対応）
  const rawSpecialLaborIns = v([
    "特別加入の労働保険番号",
    "労働保険番号(特別加入)",
    "特別加入労働保険番号",
    "Special_Insurance_num"
  ]);
  const fullSpecialDigits = padGridValue(rawSpecialLaborIns, 14);

  // 2. 年金証書番号
  const pJurisdiction = v(["年金証書番号(管轄局・最初の2桁)", "年金証書番号(管轄局)"]);
  const pType = v(["年金証書番号(種別・3桁目)", "年金証書番号(種別)"]);
  const pNumber = v(["年金証書番号(4桁目以降)", "年金証書番号(番号)"]);

  const rawPension = toHalfWidth(v("年金証書番号") || "");
  const pensionJurisdiction = pJurisdiction || rawPension.slice(0, 2);
  const pensionType         = pType || rawPension.slice(2, 3);
  const pensionNumber       = pNumber || rawPension.slice(3);

  // 3. 連絡先・住所情報
  const workerZip   = parseZip(v(["本人郵便番号(例: 123-4567)", "本人郵便番号"]));
  const workerPhone = parsePhone(v(["本人電話番号(例: 090-1234-5678)", "本人電話番号"]));
  const compZip     = parseZip(v(["証明会社郵便番号(例: 604-8130)", "証明会社郵便番号"]));
  const compPhone   = parsePhone(v(["証明会社電話番号(例: 075-221-8800)", "証明会社電話番号"]));

  // 4. 日付分解
  const birthYmd      = parseFlexibleDate(v(["生年月日(例: 55年5月15日→550515)", "生年月日"]));
  const injuryYmd     = parseFlexibleDate(v(["負傷年月日(例: 令和8年8月29日→080829)", "負傷年月日"]));
  
  // Form6の記入日／事業主証明年月日（無ければForm5から継承）
  const fillDateStr   = v("Form6記入日(空欄の場合はForm5の記入日を自動継承)") || v("記入日(例: 令和8年8月30日)") || v("記入日");
  const proofDateStr  = v("Form6事業主証明年月日(空欄の場合はForm5の証明日を自動継承)") || v("事業主証明年月日(例: 令和8年7月29日)") || v("事業主証明年月日") || v("証明年月日");

  const fillDateYmd   = parseFlexibleDate(fillDateStr);
  const proofDateYmd  = parseFlexibleDate(proofDateStr);

  // 元号整形
  const birthEraCode = v("生年月日の和暦(昭和は5, 平成は7, 令和は9と数字のみ入力)") || "5";
  const formattedBirthYear = formatBirthYear(birthEraCode, birthYmd.year);

  const formattedFillYear = formatReiwaYear(fillDateYmd.year);
  const formattedInjuryYear = formatReiwaYear(injuryYmd.year);
  const formattedProofYear = formatReiwaYear(proofDateYmd.year);

  // 特別加入日
  const rawJoiningDate = v(["特別加入日(例: 令和5年4月1日)", "特別加入日", "加入年月日", "Year_of_joining"]) || "";
  const joiningDateParsed = parseJoiningDate(rawJoiningDate);

  // 5. 本人情報
  const workerName  = v(["氏名(漢字)", "氏名", "本人氏名"]);
  
  // 住所の結合（都道府県 + 市町村以降）
  const pref = v("住所都道府県") || "";
  const city = v("住所市町村以降") || "";
  const fullAddress = (pref + city) || v("労働者住所") || v("住所");

  const sexVal = v("性別(男性は1、女性は3と入力)") || v("性別");
  const isMale   = sexVal === "1" ? "○" : "";
  const isFemale = sexVal === "3" ? "○" : "";

  // 6. 負傷時刻
  const rawTimeType = v("負傷時刻区分(AM または PMと入力)") || v("負傷時刻区分") || "";
  const upperTimeType = rawTimeType.toUpperCase();
  const isAM = upperTimeType.includes("AM") || rawTimeType === "午前" || rawTimeType === "○";
  const isPM = upperTimeType.includes("PM") || rawTimeType === "午後";

  const disasterHour   = toHalfWidth(v(["負傷時刻(時・数字のみ)", "負傷時刻(時)", "disaster_hour"]));
  const disasterMinute = toHalfWidth(v(["負傷時刻(分・数字のみ)", "負傷時刻(分)", "disaster_minute"]));

  // 7. 各病院情報（★入力サンプルのプレースホルダー付きキー名を完全追加）
  const h1DesignatedNo = v(["初診病院の労災指定医番号", "designated_Hospital"]);
  const h2DesignatedNo = v(["1回目の転院先の労災指定医番号"]);

  const h1Name    = v(["診療を受けた病院名", "変更前病院名"]);
  const h1Address = v(["診療を受けた病院住所", "変更前病院住所"]);
  const h1Zip     = parseZip(v(["診療を受けた病院郵便番号(例: 100-0001)", "診療を受けた病院郵便番号", "変更前病院郵便番号"]));

  const h2Name    = v(["1回目の転院先病院名", "変更後病院名"]);
  const h2Address = v(["1回目の病院の住所", "変更後病院住所"]);
  const h2Zip     = parseZip(v(["1回目の病院の郵便番号(例: 123-4567)", "1回目の病院の郵便番号", "変更後病院郵便番号"]));
  
  // ★1回目の転院理由（改行コードを除去してテキスト整形）
  const rawH2Reason = v([
    "1回目の転院理由(例: 精密検査・手術入院加療のため、自宅近くで通院するため 等)",
    "1回目の転院理由",
    "変更理由"
  ]) || "";
  const h2Reason = rawH2Reason.replace(/\r?\n/g, "").trim();

  const h3Name    = v(["2回目の転院先病院名"]);
  const h3Address = v(["2回目の病院の住所"]);
  const h3Zip     = parseZip(v(["2回目の病院の郵便番号(例: 123-4567)", "2回目の病院の郵便番号"]));
  
  const rawH3Reason = v([
    "2回目の転院理由(例: 退院後、自宅近くでリハビリ通院を行うため 等)",
    "2回目の転院理由"
  ]) || "";
  const h3Reason = rawH3Reason.replace(/\r?\n/g, "").trim();

  // 8. 裏面（Page 2）用項目（★入力サンプルのキー名に対応）
  const multipleVal = v([
    "その他就業先が有る場合(有と入力、無ければ空欄)",
    "その他就業先の有無",
    "複数就業有無",
    "Multiple"
  ]) || "";
  // "有" であれば "〇" に変換（それ以外や空欄の場合は空文字）
  const multipleVal = multipleValRaw === "有" ? "〇" : "";

  const numWorkplacesVal = v([
    "表面以外の就業先の数(数字のみ)",
    "有の場合のその数",
    "Number_of_workplaces",
    "就業先数"
  ]) || "";

  const specialOrgName = v([
    "労働保険事務組合等の名称",
    "労働保険事務組合又は特別加入団体の名称",
    "特別加入団体名",
    "Name_of_Special_Member_Organization",
    "ame_of_Special_Member_Organization"
  ]) || "";

  const commonData: MappedFormData = {
    // 表面（Page 1）
    "Area_of_the_Labor_Standards_Inspection_Office": v(["管轄労働基準監督署名(例: 京都南)", "管轄労働基準監督署名", "労働基準監督署長殿"]),
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
    "age": toHalfWidth(v(["年齢(数字のみ)", "年齢"])),
    "Claimant's_address": fullAddress,
    "Job_type": v("職種"),

    "injury_year": formattedInjuryYear,
    "injury_month": injuryYmd.month,
    "injury_day": injuryYmd.day,
    "injury_time_am": isAM ? "○" : "",
    "injury_time_pm": isPM ? "○" : "",
    "disaster_hour": disasterHour,
    "disaster_minute": disasterMinute,

    "accident_detail": v(["災害の原因と発生状況(詳しく)", "災害の原因及び発生状況"]),
    "Location_and_condition_of_the_injury": v(["傷病の部位及び状態", "傷病名"]),

    "Year_of_proof_of_fact": formattedProofYear,
    "Month_of_Proof_of_Fact": proofDateYmd.month,
    "The_day_of_proof_of_fact": proofDateYmd.day,
    "Company_Name": v(["証明会社名(事業の名称)", "証明会社名"]),
    "Company_zip_first": compZip.first,
    "Company_zip_last": compZip.last,
    "Company_tel_area": compPhone.area,
    "Company_tel_city": compPhone.city,
    "Company_tel_num": compPhone.num,
    "Company_Address": v(["証明会社住所(事業場の所在地)", "証明会社住所"]),
    "Representative's_name": v(["代表者職氏名(例: 代表取締役 山田 太郎)", "代表者職氏名"]),

    "Pension_certificate_jurisdiction": pensionJurisdiction,
    "Pension_certificate_type": pensionType,
    "Pension_certificate_number": pensionNumber,

    // 裏面（Page 2）指定キー名
    "Multiple": multipleVal === "有" ? "有" : multipleVal,
    "Number_of_workplaces": numWorkplacesVal,
    "Name_of_Special_Member_Organization": specialOrgName,
    "ame_of_Special_Member_Organization": specialOrgName,
    "Special_Insurance_num": fullSpecialDigits,
    "Year_of_joining": joiningDateParsed.year,
    "Joining_Month": joiningDateParsed.month,
    "Joining_date": joiningDateParsed.day
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
    "Reason_for_after_Hospital": h2Reason
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
      "Reason_for_after_Hospital": h3Reason
    });
  }

  return results;
}
