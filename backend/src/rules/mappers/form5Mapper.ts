import { RawInputData, MappedFormData } from "../../types/form";
import {
  getVal,
  padGridValue,
  parsePhone,
  parseZip,
  parseFlexibleDate,
  toHalfWidth,
  wrapText,
  stripHospitalSuffix,
} from "../utils/textUtils";

export function buildForm5Data(
  rawInput: RawInputData,
  targetType: "hospital" | "pharmacy" = "hospital"
): MappedFormData {
  const v = (key: string) => getVal(rawInput, key);

  // 1. 本人共通情報の取得・分解（請求人欄へコピーするため）
  const workerName = v("氏名");
  const prefStr = v("住所都道府県");
  const cityStr = v("住所市町村以降");
  const fullAddress = prefStr + cityStr; // 請求人住所に結合して使用

  const workerZip = parseZip(v("本人郵便番号"));
  const workerPhone = parsePhone(v("本人電話番号"));

  // 2. 労働保険番号 (14桁半角)
  const rawLaborIns = v("労働保険番号");
  const fullLaborIns = padGridValue(rawLaborIns, 14);

  // 3. 会社情報・所属事業場情報の分解
  const compZip = parseZip(v("証明会社郵便番号"));
  const compPhone = parsePhone(v("証明会社電話番号"));
  const affCompPhone = parsePhone(v("その会社の電話番号"));

  // 4. 病院 / 薬局 の動的切替
  const isPharmacy = targetType === "pharmacy";

  const hospName = isPharmacy
    ? (v("調剤を受けた薬局名") || v("診療を受けた病院名"))
    : (v("診療を受けた病院名") || v("調剤を受けた薬局名"));

  const hospAddress = isPharmacy
    ? (v("薬局の住所") || v("診療を受けた病院住所"))
    : (v("診療を受けた病院住所") || v("薬局の住所"));

  const hospZipRaw = isPharmacy
    ? (v("薬局の郵便番号") || v("診療を受けた病院郵便番号"))
    : (v("診療を受けた病院郵便番号") || v("薬局の郵便番号"));
  const hospZip = parseZip(hospZipRaw);

  const hospPhoneRaw = isPharmacy
    ? (v("薬局の電話番号") || v("病院電話番号"))
    : (v("病院電話番号") || v("薬局の電話番号"));
  const hospPhone = parsePhone(hospPhoneRaw);

  // 指定病院等名称 (末尾の「病院・診療所・薬局・クリニック」を削除)
  const cleanClaimHospName = stripHospitalSuffix(hospName);

  // 5. 各種日付の分解
  const birthYmd = parseFlexibleDate(v("生年月日"));
  const injuryYmd = parseFlexibleDate(v("負傷年月日"));
  const proofDateYmd = parseFlexibleDate(v("事業主証明年月日"));
  const fillDateYmd = parseFlexibleDate(v("記入日"));
  const joiningDateYmd = parseFlexibleDate(v("特別加入日"));

  // 6. 区分フラグ
  const rawTimeType = v("負傷時刻区分");
  const isAM = rawTimeType.toUpperCase().includes("AM");
  const isPM = rawTimeType.toUpperCase().includes("PM");

  // 監督署名
  const inspectorateOffice = v("管轄労働基準監督署名");

  const multipleRaw = v("その他就業先の有無");

  // 7. 文字列のカット処理
  const nameInKatakana = v("氏名フリガナ").slice(0, 16);
  const addressInKana = v("住所市町村以降フリガナ").slice(0, 27);

  return {
    "Labor_insurance_No.": fullLaborIns,
    "sex": v("性別"),
    "Date_of_birth,Japanese_era": v("生年月日の和暦"),
    "date_of_birth": birthYmd.padded6,
    "Date_of_injury,Japanese_era": "9",
    "Date_of_injury": injuryYmd.padded6,
    "Name_in_Katakana": nameInKatakana,
    "worker_name": workerName,
    "age": toHalfWidth(v("年齢")),

    // 本人の郵便番号
    "zip_first": workerZip.first,
    "zip_last": workerZip.last,

    "Personal_address_and_prefecture,and_phonetic_spelling": v("住所都道府県フリガナ").slice(0, 27),
    "Personal_address_and_prefecture": prefStr,
    "Personal_address_in_kana": addressInKana,
    "Personal_address": cityStr,
    "Job_type": v("職種"),

    "time_am": isAM ? "〇" : "",
    "time_pm": isPM ? "〇" : "",
    "disaster_hour": toHalfWidth(v("負傷時刻(時)")),
    "disaster_minute": toHalfWidth(v("負傷時刻(分)")),

    "accident_detail": v("災害の原因と発生状況"),

    "Title_of_the_person_verifying_the_facts": v("災害事実の確認者職名"),
    "Name_of_the_person_who_confirmed_the_facts": v("災害事実の確認者氏名"),

    // 病院・薬局情報
    "Hospital_name": hospName,
    "Hospital_Address": hospAddress,
    "Hospital_tel_area": hospPhone.area,
    "Hospital_tel_city": hospPhone.city,
    "Hospital_tel_num": hospPhone.num,
    "Hospital_zip_first": hospZip.first,
    "Hospital_zip_last": hospZip.last,
    "Claim_Hospital_name": wrapText(cleanClaimHospName, 7),

    "Location_and_condition_of_the_injury": wrapText(v("傷病の部位及び状態"), 25),

    // 証明事業主情報
    "Company_Name": v("証明会社名"),
    "Company_Address": wrapText(v("証明会社住所"), 28),
    "Representative's_name": v("代表者職氏名"),
    "Year_of_proof_of_fact": proofDateYmd.year,
    "Month_of_Proof_of_Fact": proofDateYmd.month,
    "The_day_of_proof_of_facts": proofDateYmd.day,
    "Company_tel_area": compPhone.area,
    "Company_tel_city": compPhone.city,
    "Company_tel_num": compPhone.num,
    "Company_zip_first": compZip.first,
    "Company_zip_last": compZip.last,

    // 所属事業場情報
    "Company_name_and_representative's_name": v("所属事業場の名称・所在地"),
    "The_person's_affiliated_company_tel_area": affCompPhone.area,
    "The_person's_affiliated_company_tel_city": affCompPhone.city,
    "The_person's_affiliated_company_tel_num": affCompPhone.num,

    // 請求人情報
    "Area_of_the_Labor_Standards_Inspection_Office": inspectorateOffice,
    "claimant_zip_first": workerZip.first,
    "claimant_zip_last": workerZip.last,
    "Claimant's_address": fullAddress,
    "Claimant's_name": workerName,
    "claimant_tel_area": workerPhone.area,
    "claimant_tel_city": workerPhone.city,
    "claimant_tel_num": workerPhone.num,
    "Year_of_entry": fillDateYmd.year,
    "Month_of_entry": fillDateYmd.month,
    "Date_of_entry": fillDateYmd.day,

    // 裏面項目
    "Multiple": multipleRaw === "有" ? "〇" : "",
    "Number_of_workplaces": toHalfWidth(v("表面以外の就業先の数")),
    "Special_Insurance_num": v("特別加入の労働保険番号"),
    "Name_of_Special_Member_Organization": v("労働保険事務組合等の名称"),
    "Year_of_joining": joiningDateYmd.year,
    "Joining_Month": joiningDateYmd.month,
    "Joining_date": joiningDateYmd.day,
  };
}
