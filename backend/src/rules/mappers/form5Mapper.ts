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
 * 様式第5号専用データマッパー
 * @param rawInput ユーザー入力データ
 * @param targetType 'hospital'(病院用) または 'pharmacy'(薬局用)
 */
export function buildForm5Data(
  rawInput: RawInputData,
  targetType: "hospital" | "pharmacy" = "hospital"
): MappedFormData {
  const v = (key: string) => getVal(rawInput, key);

  // 1. 労働保険番号（14桁数字を半角揃え）
  const rawLaborIns = v("労働保険番号(14桁・ハイフンなし)") || v("労働保険番号");
  const fullLaborIns = padGridValue(rawLaborIns, 14);

  // 2. 本人・会社等の連絡先分解
  const workerZip    = parseZip(v("本人郵便番号(例: 123-4567)"));
  const workerPhone  = parsePhone(v("本人電話番号(例: 090-1234-5678)"));
  const compZip      = parseZip(v("証明会社郵便番号(例: 604-8130)"));
  const compPhone    = parsePhone(v("証明会社電話番号(例: 075-221-8800)"));
  const affCompPhone = parsePhone(v("その会社の電話番号(例: 03-1234-5678)"));

  // 3. 病院用 / 薬局用の切り替え処理
  const isPharmacy = targetType === "pharmacy";

  const hospName = isPharmacy
    ? (v("調剤を受けた薬局名") || v("診療を受けた病院名"))
    : (v("診療を受けた病院名") || v("調剤を受けた薬局名"));

  const hospAddress = isPharmacy
    ? (v("薬局の住所") || v("診療を受けた病院住所"))
    : (v("診療を受けた病院住所") || v("薬局の住所"));

  const hospZipRaw = isPharmacy
    ? (v("薬局の郵便番号(例: 100-0001)") || v("診療を受けた病院郵便番号(例: 100-0001)"))
    : (v("診療を受けた病院郵便番号(例: 100-0001)") || v("薬局の郵便番号(例: 100-0001)"));
  const hospZip = parseZip(hospZipRaw);

  const hospPhoneRaw = isPharmacy
    ? (v("薬局の電話番号(例: 03-1234-5678)") || v("病院電話番号(例: 03-1234-5678)"))
    : (v("病院電話番号(例: 03-1234-5678)") || v("薬局の電話番号(例: 03-1234-5678)"));
  const hospPhone = parsePhone(hospPhoneRaw);

  // 4. 日付分解
  const birthYmd       = parseFlexibleDate(v("生年月日(例: 55年5月15日→550515)"));
  const injuryYmd      = parseFlexibleDate(v("負傷年月日(例: 令和8年8月29日→080829)"));
  const proofDateYmd   = parseFlexibleDate(v("事業主証明年月日(例: 令和8年7月29日)"));
  const fillDateYmd    = parseFlexibleDate(v("記入日(例: 令和8年8月30日)"));
  const joiningDateYmd = parseFlexibleDate(v("特別加入日(例: 令和5年4月1日)"));

  // 5. 区分フラグ
  const rawTimeType = v("負傷時刻区分(AM または PMと入力)");
  const isAM = rawTimeType.toUpperCase().includes("AM");
  const isPM = rawTimeType.toUpperCase().includes("PM");

  // 6. 住所・名称等
  const prefStr     = v("住所都道府県");
  const cityStr     = v("住所市町村以降");
  const fullAddress = prefStr + cityStr;
  const workerName  = v("氏名(漢字)");

  let inspectorateOffice = v("管轄労働基準監督署名(例: 京都南)");
  if (inspectorateOffice && !inspectorateOffice.endsWith("労働基準監督署")) {
    inspectorateOffice += "労働基準監督署";
  }

  const multipleRaw = v("その他就業先が有る場合(有と入力、無ければ空欄)");
  const multipleMark = multipleRaw === "有" ? "〇" : "";

  // 7. 長文折返し・文字数制限カット処理
  const wrappedAccidentDetail = wrapText(v("災害の原因と発生状況(詳しく)"), 47); // 47文字折り返し
  const wrappedClaimHospName  = wrapText(hospName, 7);                           // 7文字折り返し
  const wrappedInjuryStatus   = wrapText(v("傷病の部位及び状態"), 25);
  const wrappedCompanyAddr    = wrapText(v("証明会社住所(事業場の所在地)"), 28);

  const truncatedKatakanaName = v("氏名フリガナ(全角カタカナ・姓と名の間にスペース)").slice(0, 16); // 16文字カット
  const truncatedKanaPref     = v("住所都道府県フリガナ").slice(0, 27);                           // 27文字カット

  return {
    "Labor_insurance_No.": fullLaborIns,
    "sex": v("性別(男性は1、女性は3と入力)"),
    "Date_of_birth,Japanese_era": v("生年月日の和暦(昭和は5, 平成は7, 令和は9と数字のみ入力)"),
    "date_of_birth": `${birthYmd.year}${birthYmd.month}${birthYmd.day}`,
    "Date_of_injury,Japanese_era": "9",
    "Date_of_injury": `${injuryYmd.year}${injuryYmd.month}${injuryYmd.day}`,
    "Name_in_Katakana": truncatedKatakanaName,
    "worker_name": workerName,
    "age": toHalfWidth(v("年齢(数字のみ)")),

    "zip_first": workerZip.first,
    "zip_last": workerZip.last,

    "Personal_address_and_prefecture,and_phonetic_spelling": truncatedKanaPref,
    "Personal_address_and_prefecture": prefStr,
    "Personal_address_in_kana": v("住所市町村以降フリガナ"),
    "Personal_address": cityStr,
    "Job_type": v("職種"),

    "time_am": isAM ? "〇" : "",
    "time_pm": isPM ? "〇" : "",
    "disaster_hour": toHalfWidth(v("負傷時刻(時・数字のみ)")),
    "disaster_minute": toHalfWidth(v("負傷時刻(分・数字のみ)")),

    "accident_detail": wrappedAccidentDetail,

    // 確認者情報（追加項目）
    "Title_of_the_person_verifying_the_facts": v("災害事実の確認者職名"),
    "Name_of_the_person_who_confirmed_the_facts": v("災害事実の確認者氏名"),

    // 病院/薬局で動的切替される項目
    "Hospital_name": hospName,
    "Hospital_Address": hospAddress,
    "Hospital_tel_area": hospPhone.area,
    "Hospital_tel_city": hospPhone.city,
    "Hospital_tel_num": hospPhone.num,
    "Hospital_zip_first": hospZip.first,
    "Hospital_zip_last": hospZip.last,
    "Claim_Hospital_name": wrappedClaimHospName,

    "Location_and_condition_of_the_injury": wrappedInjuryStatus,

    "Company_Name": v("証明会社名(事業の名称)"),
    "Company_Address": wrappedCompanyAddr,
    "Representative's_name": v("代表者職氏名(例: 代表取締役 山田 太郎)"),
    "Year_of_proof_of_fact": proofDateYmd.year,
    "Month_of_Proof_of_Fact": proofDateYmd.month,
    "The_day_of_proof_of_facts": proofDateYmd.day,
    "Company_tel_area": compPhone.area,
    "Company_tel_city": compPhone.city,
    "Company_tel_num": compPhone.num,
    "Company_zip_first": compZip.first,
    "Company_zip_last": compZip.last,

    "Company_name_and_representative's_name": v("所属事業場の名称・所在地"),
    "The_person's_affiliated_company_tel_area": affCompPhone.area,
    "The_person's_affiliated_company_tel_city": affCompPhone.city,
    "The_person's_affiliated_company_tel_num": affCompPhone.num,

    "Area_of_the_Labor_Standards_Inspection_Office": inspectorateOffice,
    "claimant_zip_first": workerZip.first,
    "claimant_zip_last": workerZip.last,
    "Year_of_entry": fillDateYmd.year,
    "Month_of_entry": fillDateYmd.month,
    "Date_of_entry": fillDateYmd.day,
    "claimant_tel_area": workerPhone.area,
    "claimant_tel_city": workerPhone.city,
    "claimant_tel_num": workerPhone.num,
    "Claimant's_address": fullAddress,
    "Claimant's_name": workerName,

    "Multiple": multipleMark,
    "Number_of_workplaces": toHalfWidth(v("表面以外の就業先の数(数字のみ)")),
    "Special_Insurance_num": padGridValue(v("特別加入の労働保険番号"), 14),
    "Name_of_Special_Member_Organization": v("労働保険事務組合等の名称"),
    "Year_of_joining": joiningDateYmd.year,
    "Joining_Month": joiningDateYmd.month,
    "Joining_date": joiningDateYmd.day
  };
}
