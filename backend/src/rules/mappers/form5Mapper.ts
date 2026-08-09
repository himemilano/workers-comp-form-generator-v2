import { parseYYMMDD, parseJapaneseDate } from "../date";
import { splitPostalCode } from "../postalCode";
import { splitPhoneNumber } from "../phone";
import { trimFacilitySuffix } from "../name";
import { truncateKana } from "../kana";
import { parseInjuryTime } from "../time";

/**
 * rawInput[key] から 「:」 または 「：」 より後ろの実データを抽出する関数
 */
function getVal(rawInput: Record<string, string>, key: string): string {
  const raw = rawInput[key] || "";
  if (!raw) return "";
  
  const colonIndex = Math.max(raw.indexOf("："), raw.indexOf(":"));
  const value = colonIndex !== -1 ? raw.substring(colonIndex + 1) : raw;
  return value.trim();
}

/**
 * form5_input_template.txt の入力データを schemas/form5.json の ID 一覧へ厳格に割り当てる
 */
export function buildForm5Data(
  rawInput: Record<string, string>,
  _fillAllForTest: boolean = false
): Record<string, string> {
  const v = (key: string) => getVal(rawInput, key);

  // --- 1. 労働保険番号 (5つのパーツを単純連結して14桁化) ---
  const pref         = v("労働保険番号_府県(2桁)");
  const jurisdiction = v("労働保険番号_所掌(1桁)");
  const office       = v("労働保険番号_管轄(2桁)");
  const basic        = v("労働保険番号_基幹番号(6桁)");
  const branch       = v("労働保険番号_枝番号(3桁)");
  const fullLaborIns = `${pref}${jurisdiction}${office}${basic}${branch}`;

  // --- 2. 本人情報（郵便番号・電話番号の分割） ---
  const workerZip   = splitPostalCode(v("本人郵便番号(例: 123-4567)"));
  const workerPhone = splitPhoneNumber(v("本人電話番号(例: 090-1234-5678)"));

  // 病院・会社・所属会社の郵便番号・電話番号
  const hospZip    = splitPostalCode(v("診療を受けた病院郵便番号(例: 100-0001)") || v("薬局の郵便番号(例: 100-0001)"));
  const hospPhone  = splitPhoneNumber(v("病院電話番号(例: 03-1234-5678)") || v("薬局の電話番号(例: 03-1234-5678)"));
  const compZip    = splitPostalCode(v("証明会社郵便番号(例: 604-8130)"));
  const compPhone  = splitPhoneNumber(v("証明会社電話番号(例: 075-221-8800)"));
  const affCompPhone = splitPhoneNumber(v("その会社の電話番号(例: 075-222-3333)"));

  // --- 3. 日付・時間のパース ---
  const birthYmd       = parseYYMMDD(v("生年月日(例: 55年5月15日→550515)"));
  const injuryYmd      = parseYYMMDD(v("負傷年月日(例: 令和8年8月29日→080829)"));
  const proofDateYmd   = parseJapaneseDate(v("事業主証明年月日(例: 令和8年7月29日)"));
  const fillDateYmd    = parseJapaneseDate(v("記入日(例: 令和8年8月30日)"));
  const joiningDateYmd = parseJapaneseDate(v("特別加入日(例: 令和5年4月1日)"));

  const rawTimeType = v("負傷時刻区分(AM または PM)");
  const rawHour     = v("負傷時刻(時)");
  const rawMin      = v("負傷時刻(分)");
  const timeInfo    = parseInjuryTime(rawTimeType, rawHour, rawMin);

  // 病院・住所・氏名
  const hospNameCleaned = trimFacilitySuffix(v("診療を受けた病院名") || v("調剤を受けた薬局名"));
  const hospAddress     = v("診療を受けた病院住所") || v("薬局の住所");
  const prefStr         = v("住所都道府県");
  const cityStr         = v("住所市町村以降");
  const fullAddress     = prefStr + cityStr;
  const workerName      = v("氏名(漢字)");

  // その他就業先（有の場合のみ「〇」、それ以外は空文字）
  const multipleRaw = v("その他就業先が有る場合(有と入力、無ければ空欄)");
  const multipleMark = multipleRaw === "有" ? "〇" : "";

  // --- 4. schemas/form5.json への厳格マッピング ---
  return {
    // --- 表面 (Page 1) ---
    "Labor_insurance_No.": fullLaborIns,
    "sex": v("性別(男性は1、女性は3)"),
    "Date_of_birth,Japanese_era": v("生年月日の和暦(昭和5, 平成7, 令和9)"),
    "date_of_birth": (birthYmd.year || "") + (birthYmd.month || "") + (birthYmd.day || ""),
    "Date_of_injury,Japanese_era": "9", // 令和固定
    "Date_of_injury": (injuryYmd.year || "") + (injuryYmd.month || "") + (injuryYmd.day || ""),
    "Name_in_Katakana": truncateKana(v("氏名フリガナ(全角カタカナ・姓と名の間にスペース)"), 16),
    "worker_name": workerName,
    "age": v("年齢(数字のみ)"),

    // 本人郵便番号 -> zip_first / zip_last
    "zip_first": workerZip.first,
    "zip_last": workerZip.last,

    "Personal_address_and_prefecture,and_phonetic_spelling": v("住所都道府県フリガナ"),
    "Personal_address_and_prefecture": prefStr,
    "Personal_address_in_kana": v("住所市町村以降フリガナ"),
    "Personal_address": cityStr,
    "Job_type": v("職種"),
    "time_am": timeInfo.amMark,
    "time_pm": timeInfo.pmMark,
    "disaster_hour": timeInfo.hour,
    "disaster_minute": timeInfo.minute,
    "Title_of_the_person_verifying_the_facts": "",
    "Name_of_the_person_who_confirmed_the_facts": "",
    "accident_detail": v("災害の原因と発生状況"),
    "Hospital_name": hospNameCleaned,
    "Hospital_Address": hospAddress,
    "Hospital_tel_area": hospPhone.area,
    "Hospital_tel_city": hospPhone.city,
    "Hospital_tel_num": hospPhone.num,
    "Hospital_zip_first": hospZip.first,
    "Hospital_zip_last": hospZip.last,
    "Location_and_condition_of_the_injury": v("傷病の部位及び状態"),

    // 会社関連情報
    "Company_Name": v("証明会社名(事業の名称)"),
    "Company_Address": v("証明会社住所(事業場の所在地)"),
    "Representative's_name": v("代表者職氏名(例: 代表取締役 山田 太郎)"),
    "Year_of_proof_of_fact": proofDateYmd.year,
    "Month_of_Proof_of_Fact": proofDateYmd.month,
    "The_day_of_proof_of_facts": proofDateYmd.day,
    "Company_tel_area": compPhone.area,
    "Company_tel_city": compPhone.city,
    "Company_tel_num": compPhone.num,
    "Company_zip_first": compZip.first,
    "Company_zip_last": compZip.last,

    // 本人所属会社（異なる場合）
    "Company_name_and_representative's_name": v("所属事業場の名称・所在地"),
    "The_person's_affiliated_company_tel_area": affCompPhone.area,
    "The_person's_affiliated_company_tel_city": affCompPhone.city,
    "The_person's_affiliated_company_tel_num": affCompPhone.num,

    // --- 請求人情報（本人データの流用割り当て） ---
    "Area_of_the_Labor_Standards_Inspection_Office": v("管轄労働基準監督署名(例: 京都南)"),
    "Claim_Hospital_name": hospNameCleaned,
    "claimant_zip_first": workerZip.first,   // workerZip を流用
    "claimant_zip_last": workerZip.last,     // workerZip を流用
    "Year_of_entry": fillDateYmd.year,
    "Month_of_entry": fillDateYmd.month,
    "Date_of_entry": fillDateYmd.day,
    "claimant_tel_area": workerPhone.area,   // workerPhone を流用
    "claimant_tel_city": workerPhone.city,   // workerPhone を流用
    "claimant_tel_num": workerPhone.num,     // workerPhone を流用
    "Claimant's_address": fullAddress,       // 本人住所を流用
    "Claimant's_name": workerName,           // 本人氏名を流用

    // --- 裏面 (Page 2) ---
    "Multiple": multipleMark,
    "Number_of_workplaces": v("表面以外の就業先の数(数字のみ)"),
    "Special_Insurance_num": v("特別加入の労働保険番号"),
    "Name_of_Special_Member_Organization": v("労働保険事務組合等の名称"),
    "Year_of_joining": joiningDateYmd.year,
    "Joining_Month": joiningDateYmd.month,
    "Joining_date": joiningDateYmd.day
  };
}
