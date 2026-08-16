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
 * 診療を受けた所の名前（病院・診療所・クリニック・薬局等の文字を除去）
 */
function cleanHospitalName(name: string): string {
  if (!name) return "";
  return name.trim().replace(/(病院|診療所|クリニック|薬局)/g, "").trim();
}

/**
 * 様式第6号専用データマッパー
 * 転院回数（2回目転院先の有無）に応じて 1枚 または 2枚分（配列）の MappedFormData を返却します。
 */
export function buildForm6Data(
  form5RawInput: RawInputData,
  form6RawInput: RawInputData
): MappedFormData[] {
  // Form5 と Form6 の入力データを統合（Form6の入力値を優先）
  const combinedInput: RawInputData = {
    ...form5RawInput,
    ...form6RawInput
  };

  const v = (key: string) => getVal(combinedInput, key);

  // 1. 労働保険番号 (14桁: 前2桁 / 残り12桁)
  const rawLaborIns = v("労働保険番号(14桁・ハイフンなし)") || v("労働保険番号");
  const full14Digits = padGridValue(rawLaborIns, 14);
  const laborInsFirst = full14Digits.slice(0, 2);
  const laborInsLast  = full14Digits.slice(2, 14);

  // 2. 年金証書番号の分解（個別キーおよび一括入力の両方に対応）
  const pJurisdiction = v("年金証書番号(管轄局・最初の2桁)") || v("年金証書番号(管轄局)");
  const pType = v("年金証書番号(種別・3桁目)") || v("年金証書番号(種別)");
  const pNumber = v("年金証書番号(4桁目以降)") || v("年金証書番号(番号)");

  const rawPension = toHalfWidth(v("年金証書番号") || "");
  const pensionJurisdiction = pJurisdiction || rawPension.slice(0, 2);
  const pensionType         = pType || rawPension.slice(2, 3);
  const pensionNumber       = pNumber || rawPension.slice(3);

  // 3. 本人・会社・郵便番号・電話番号
  const workerZip   = parseZip(v("本人郵便番号(例: 123-4567)") || v("本人郵便番号"));
  const workerPhone = parsePhone(v("本人電話番号(例: 090-1234-5678)") || v("本人電話番号"));
  const compZip     = parseZip(v("証明会社郵便番号(例: 604-8130)") || v("証明会社郵便番号") || v("その会社の郵便番号"));
  const compPhone   = parsePhone(v("証明会社電話番号(例: 075-221-8800)") || v("証明会社電話番号") || v("その会社の電話番号"));

  // 4. 日付分解（和暦・桁処理）
  const birthYmd      = parseFlexibleDate(v("生年月日(例: 55年5月15日→550515)") || v("生年月日"));
  const injuryYmd     = parseFlexibleDate(v("負傷年月日(例: 令和8年8月29日→080829)") || v("負傷年月日"));
  const proofDateYmd = parseFlexibleDate(v("事業主証明年月日(例: 令和8年7月29日)") || v("事業主証明年月日"));
  const fillDateYmd  = parseFlexibleDate(v("記入日(例: 令和8年8月30日)") || v("記入日"));

  // 5. 本人情報（届出人＝本人前提）
  const workerName  = v("氏名(漢字)") || v("氏名") || v("本人氏名");
  const prefStr     = v("住所都道府県");
  const cityStr     = v("住所市町村以降");
  const fullAddress = v("労働者住所") || v("住所") || (prefStr + cityStr);

  const sexVal = v("性別(男性は1、女性は3と入力)") || v("性別");
  const isMale   = sexVal === "1" ? "○" : "";
  const isFemale = sexVal === "3" ? "○" : "";

  // 監督署名
  const inspectorateOffice = v("管轄労働基準監督署名(例: 京都南)") || v("労働基準監督署名") || v("所轄の労基のエリア");

  // 6. 負傷時刻の判別 (AM/PM判別・時・分)
  const rawTimeType = v("負傷時刻区分(AM または PMと入力)") || v("負傷時刻区分");
  const upperTimeType = rawTimeType.toUpperCase();
  const isAM = upperTimeType.includes("AM") || rawTimeType === "午前" || rawTimeType === "○";
  const isPM = upperTimeType.includes("PM") || rawTimeType === "午後";

  const disasterHour   = toHalfWidth(v("負傷時刻(時・数字のみ)") || v("負傷時刻(時)") || v("disaster_hour"));
  const disasterMinute = toHalfWidth(v("負傷時刻(分・数字のみ)") || v("負傷時刻(分)") || v("disaster_minute"));

  // 7. 各病院情報の取得（入力テンプレートキーとの完全一致）
  // 労災指定医番号
  const h1DesignatedNo = v("初診病院の労災指定医番号") || v("初診病院の労災指定病院番号") || v("designated_Hospital");
  const h2DesignatedNo = v("1回目の転院先の労災指定医番号") || v("転院先の（1回目のみ）労災指定病院番号");

  // 初診（変更前）病院 (Form5より引き継ぎ)
  const h1Name    = v("診療を受けた病院名") || v("変更前病院名");
  const h1Address = v("診療を受けた病院住所") || v("変更前病院住所");
  const h1Zip     = parseZip(v("診療を受けた病院郵便番号(例: 100-0001)") || v("診療を受けた病院郵便番号") || v("変更前病院郵便番号"));

  // 1回目転院先（変更後）
  const h2Name    = v("1回目の転院先病院名") || v("変更後病院名");
  const h2Address = v("1回目の病院の住所") || v("変更後病院住所");
  const h2Zip     = parseZip(v("1回目の病院の郵便番号(例: 123-4567)") || v("1回目の病院の郵便番号") || v("変更後病院郵便番号"));
  const h2Reason  = v("1回目の転院理由(例: 精密検査・手術入院加療のため、自宅近くで通院するため 等)") || v("1回目の転院理由") || v("変更理由");

  // 2回目転院先（オプション）
  const h3Name    = v("2回目の転院先病院名") || v("2回目転院先病院名");
  const h3Address = v("2回目の病院の住所") || v("2回目転院先病院住所");
  const h3Zip     = parseZip(v("2回目の病院の郵便番号(例: 123-4567)") || v("2回目の病院の郵便番号") || v("2回目転院先病院郵便番号"));
  const h3Reason  = v("2回目の転院理由(例: 退院後、自宅近くでリハビリ通院を行うため 等)") || v("2回目の転院理由") || v("2回目変更理由");

  // 傷病補償年金受給後の転院先（該当時のみ）
  const pensionHospName    = v("支給後の転院病院名") || v("年金受給後転院先病院名");
  const pensionHospAddress = v("支給後の転院病院の住所") || v("年金受給後転院先住所");
  const pensionHospZip     = parseZip(v("支給後の転院病院の郵便番号") || v("年金受給後転院先郵便番号"));

  // --- 共通項目ベースオブジェクト ---
  const commonData: MappedFormData = {
    "Area_of_the_Labor_Standards_Inspection_Office": inspectorateOffice,
    "Year_of_entry": fillDateYmd.year,
    "Month_of_entry": fillDateYmd.month,
    "Date_of_entry": fillDateYmd.day,
    "zip_first": workerZip.first,
    "zip_last": workerZip.last,
    "claimant_tel_area": workerPhone.area,
    "claimant_tel_city": workerPhone.city,
    "claimant_tel_num": workerPhone.num,

    // 届け出人＝本人
    "notification_Address": fullAddress,
    "notification_Name": workerName,

    "Labor_insurance_No._first": laborInsFirst,
    "Labor_insurance_No._last": laborInsLast,
    "worker_name": workerName,
    "male": isMale,
    "female": isFemale,
    "Year_of_birth": birthYmd.year,
    "Birth_month": birthYmd.month,
    "Birth_day": birthYmd.day,
    "age": toHalfWidth(v("年齢(数字のみ)") || v("年齢")),
    "Claimant's_address": fullAddress,
    "Job_type": v("職種"),

    "injury_year": injuryYmd.year,
    "injury_month": injuryYmd.month,
    "injury_day": injuryYmd.day,
    "injury_time_am": isAM ? "○" : "",
    "injury_time_pm": isPM ? "○" : "",
    "disaster_hour": disasterHour,
    "disaster_minute": disasterMinute,

    "accident_detail": wrapText(v("災害の原因と発生状況(詳しく)") || v("災害の原因及び発生状況"), 25),
    "Location_and_condition_of_the_injury": wrapText(v("傷病の部位及び状態"), 25),

    "Year_of_proof_of_fact": proofDateYmd.year,
    "Month_of_Proof_of_Fact": proofDateYmd.month,
    "The_day_of_proof_of_fact": proofDateYmd.day,
    "Company_Name": v("証明会社名(事業の名称)") || v("証明会社名"),
    "Company_zip_first": compZip.first,
    "Company_zip_last": compZip.last,
    "Company_tel_area": compPhone.area,
    "Company_tel_city": compPhone.city,
    "Company_tel_num": compPhone.num,
    "Company_Address": wrapText(v("証明会社住所(事業場の所在地)") || v("証明会社住所"), 28),
    "Representative's_name": v("代表者職氏名(例: 代表取締役 山田 太郎)") || v("代表者職氏名"),

    "Pension_certificate_jurisdiction": pensionJurisdiction,
    "Pension_certificate_type": pensionType,
    "Pension_certificate_number": pensionNumber,

    // 傷病補償年金受給後の転院欄
    "pension_Hospital": pensionHospName,
    "pension_Hospital_Address": pensionHospAddress,
    "pension_Hospital_zip_first": pensionHospZip.first,
    "pension_Hospital_zip_last": pensionHospZip.last
  };

  const results: MappedFormData[] = [];

  // --- 1枚目（初診 → 1回目転院）の生成 ---
  const page1Data: MappedFormData = {
    ...commonData,
    "designated_Hospital": h1DesignatedNo,
    // 請求先（最上部）は転院先（病院・診療所・薬局などを除外）
    "Claim_Hospital_name": cleanHospitalName(h2Name),

    // 変更前（初診病院）
    "Hospital_name": h1Name,
    "Hospital_Address": h1Address,
    "Hospital_zip_first": h1Zip.first,
    "Hospital_zip_last": h1Zip.last,

    // 変更後（1回目転院先病院）
    "after_Hospital": h2Name,
    "after_Hospital_Address": h2Address,
    "after_Hospital_zip_first": h2Zip.first,
    "after_Hospital_zip_last": h2Zip.last,
    "Reason_for_after_Hospital": wrapText(h2Reason, 25)
  };
  results.push(page1Data);

  // --- 2枚目（1回目転院先 → 2回目転院先）の生成（2回目転院先が記入されている場合のみ） ---
  if (h3Name) {
    const page2Data: MappedFormData = {
      ...commonData,
      "designated_Hospital": h2DesignatedNo || h1DesignatedNo,
      // 2枚目の請求先（最上部）は2回目転院先（病院・診療所・薬局などを除外）
      "Claim_Hospital_name": cleanHospitalName(h3Name),

      // 変更前（1回目転院先）へシフト
      "Hospital_name": h2Name,
      "Hospital_Address": h2Address,
      "Hospital_zip_first": h2Zip.first,
      "Hospital_zip_last": h2Zip.last,

      // 変更後（2回目転院先）へシフト
      "after_Hospital": h3Name,
      "after_Hospital_Address": h3Address,
      "after_Hospital_zip_first": h3Zip.first,
      "after_Hospital_zip_last": h3Zip.last,
      "Reason_for_after_Hospital": wrapText(h3Reason, 25)
    };
    results.push(page2Data);
  }

  return results;
}
